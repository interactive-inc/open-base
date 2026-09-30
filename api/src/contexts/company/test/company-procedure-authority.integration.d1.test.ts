import { execSql } from "@system/test/local-d1/exec-sql.test-support"
import { CompanyResourceChangeEntity } from "@/contexts/company/domain/entities/company-resource-change.entity"
import { D1CompanyResourceRepository } from "@/contexts/company/infrastructure/repositories/core/d1-company-resource.repository"
import { resolveCompanyBusinessDate } from "@/contexts/company/domain/definitions/resolve-company-business-date.definition"
import { describe, expect, setDefaultTimeout, test } from "bun:test"
import { drizzle } from "drizzle-orm/d1"
import { createExternalIdentityImportTestContext } from "@/contexts/company/test/external-identity-import.test-support"
import { RevalidateCompanyProcedureAuthorityAdapter } from "@/contexts/company/infrastructure/adapters/organization/revalidate-company-procedure-authority.adapter"
import { CompanyAuthoritySnapshotGuardAdapter } from "@/contexts/company/infrastructure/adapters/organization/company-authority-snapshot-guard.adapter"
import type { ApplicationWorkflowStep } from "@/contexts/company/domain/definitions/company-procedure-workflow.definition"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

describe("Company Taskの判断時点の資格", () => {
  test("旧Account対応を撤去しても公開対応先の従業員変更を保存時に検知する", async () => {
    const fixture = await createExternalIdentityImportTestContext()
    expect((await fixture.application.execute(fixture.input)).kind).toBe("applied")
    const database = fixture.database
    const link = await database
      .prepare("SELECT account_id, employee_id FROM company_account_employee_resource_bindings")
      .first<{ account_id: string; employee_id: string }>()
    if (link === null) throw new Error("public Account correspondence missing")
    await execSql(database, "DROP TRIGGER IF EXISTS company_account_employee_links_delete_guard")
    await database
      .prepare("DELETE FROM company_account_employee_links WHERE account_id = ?1")
      .bind(link.account_id)
      .run()
    const guard = await new CompanyAuthoritySnapshotGuardAdapter({ database }).prepare({
      employeeCodes: [],
      accountIds: [zAccountId.parse(link.account_id)],
    })
    if (guard instanceof Error) throw guard
    await database
      .prepare(`UPDATE company_workforce_resource_bindings
        SET lifecycle_revision = lifecycle_revision + 1
        WHERE resource_type = 'employee' AND employee_id = ?1`)
      .bind(link.employee_id)
      .run()
    expect(
      await database.batch([guard]).then(
        () => null,
        (cause: unknown) => cause,
      ),
    ).toBeInstanceOf(Error)
  })

  test("両製品の実migrationで、従業員指定の再検査と保存時の変更検知を行う", async () => {
    const fixture = await createExternalIdentityImportTestContext()
    expect((await fixture.application.execute(fixture.input)).kind).toBe("applied")
    const database = fixture.database
    await database.prepare("UPDATE company_employees SET employee_code = 'REVIEWER'").run()
    const accountId = zAccountId.parse(
      await database
        .prepare("SELECT account_id FROM company_account_employee_links")
        .first<string>("account_id"),
    )
    const changeCode = async (employeeCode: string) => {
      const asOf = resolveCompanyBusinessDate({
        now: fixture.clock.at.toISOString(),
        timeZone: "Asia/Tokyo",
      })
      if (asOf instanceof Error) throw asOf
      const repository = new D1CompanyResourceRepository({ database })
      const snapshot = await repository.findMany({
        organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
        types: ["employee"],
        effectiveOn: asOf,
      })
      if (!snapshot.ok) throw new Error("employee snapshot unavailable")
      const employee = snapshot.resources[0]
      if (employee === undefined) throw new Error("employee missing")
      const change = CompanyResourceChangeEntity.create({
        commandId: crypto.randomUUID(),
        expectedRevision: snapshot.organizationRevision,
        actorAccountId: fixture.actor.accountId,
        reason: "Confirm employee code",
        recordedAt: fixture.clock.at.getTime(),
        resources: [
          {
            organizationId: employee.organizationId,
            type: employee.type,
            id: employee.id,
            revision: employee.revision + 1,
            state: employee.state,
            effectiveFrom: employee.effectiveFrom,
            effectiveTo: employee.effectiveTo,
            attributes: { ...employee.attributes, employeeCode },
          },
        ],
      })
      if (change instanceof Error) throw change
      expect((await repository.write(change)).kind).toBe("applied")
    }
    const step: ApplicationWorkflowStep = {
      key: "review",
      name: "Review",
      approvers: [{ type: "employee", employee_code: "REVIEWER" }],
      approval_mode: "any",
      condition_mode: "all",
      conditions: [],
      due_days: null,
      escalation_approvers: [],
      rejection_behavior: "reject",
      allow_delegation: true,
    }
    const resolver = new RevalidateCompanyProcedureAuthorityAdapter({
      env: { DB: database, COMPANY_TIME_ZONE: "Asia/Tokyo" },
      var: {
        database: drizzle(database),
        auditContext: {
          requestId: "authority-test",
          clientName: "api",
          clientIp: null,
          externalRequestId: null,
        },
      },
    })
    const input = {
      step,
      representedAccountId: accountId,
      subjectEmployeeId: null,
      targetDepartmentCode: null,
      excludedEmployeeIds: new Set<never>(),
      dueAt: null,
      decidedAt: fixture.clock.at,
    }
    // 投影tableだけを書き換えても公開履歴にないcodeでは判断できない。
    expect(await resolver.revalidate(input)).toBeInstanceOf(Error)
    await changeCode("REVIEWER")
    expect(await resolver.revalidate(input)).toBe(true)
    const guard = await new CompanyAuthoritySnapshotGuardAdapter({ database }).prepare({
      employeeCodes: ["REVIEWER"],
      accountIds: [accountId],
    })
    if (guard instanceof Error) throw guard
    expect(await database.batch([guard])).toBeArray()
    await changeCode("REPLACED")
    expect(await resolver.revalidate(input)).toBeInstanceOf(Error)
    const failure = await database
      .batch([
        database.prepare("UPDATE company_employees SET official_name = 'Uncommitted Name'"),
        guard,
      ])
      .then(
        () => null,
        (cause: unknown) => cause,
      )
    expect(failure).toBeInstanceOf(Error)
    expect(
      await database
        .prepare("SELECT official_name FROM company_employees")
        .first<string>("official_name"),
    ).toBe("Example Person")
  })
})
