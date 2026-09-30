import { execSql } from "@system/test/local-d1/exec-sql.test-support"
import { CompanyAssignmentResourceHistoryAdapter } from "@/contexts/company/infrastructure/adapters/organization/company-assignment-resource-history.adapter"
import { describe, expect, setDefaultTimeout, spyOn, test } from "bun:test"
import { z } from "zod"
import { EmployeeLifecycleAdapter } from "@/contexts/company/infrastructure/adapters/employee-lifecycle/employee-lifecycle.adapter"
import type { PersonnelActionInput } from "@/contexts/company/domain/definitions/lifecycle-types.definition"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { D1CompanyResourceRepository } from "@/contexts/company/infrastructure/repositories/core/d1-company-resource.repository"
import { CompanyResourceChangeEntity } from "@/contexts/company/domain/entities/company-resource-change.entity"
import { ResolveCanonicalOrganizationAuthorityAdapter } from "@/contexts/company/infrastructure/adapters/workforce/resolve-canonical-organization-authority.adapter"
import { createCompanyAssignmentResourceTestContext } from "@/contexts/company/test/company-assignment-resource.test-support"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

describe("公開Assignmentと業務の所属期間", () => {
  test("上長本人の退職APIは部下の関係を終了し、再送・訂正・再入社で旧上長を復活させない", async () => {
    const f = await createCompanyAssignmentResourceTestContext()
    await f.initializeAssignment()
    const managerId = f.people[1]!.employeeId
    await f.assignEmployeeCode(managerId, "MANAGER-001")
    expect(
      await f.personnel(
        {
          kind: "manager_changed",
          employeeCode: "EMPLOYEE-001",
          eventOn: restoreCalendarDate("2030-03-01"),
          departmentCode: "TEAM",
          assignmentType: "primary",
          managerEmployeeCode: "MANAGER-001",
        },
        "reporting:manager-before-exit",
      ),
    ).toMatchObject({ replayed: false })
    const revisions = await new EmployeeLifecycleAdapter(f.context).loadRevisions(managerId)
    if (revisions instanceof Error) throw revisions
    const request = {
      json: {
        action: { kind: "retired", employeeCode: "MANAGER-001", retirementOn: "2030-06-30" },
        expected_company_revision: await f.companyRevision(),
        expected_employee_revision: revisions.employeeRevision,
        expected_organization_revision: revisions.organizationRevision,
      },
    } satisfies Parameters<typeof f.client.executions.$post>[0]
    const options = { headers: { "idempotency-key": "reporting:manager-exit" } }
    const retired = await f.client.executions.$post(request, options)
    expect(Number(retired.status)).toBe(201)
    const action = z.object({ id: z.string() }).parse(await retired.json())
    expect(await f.publicReporting("2030-06-30")).toHaveLength(1)
    expect(await f.publicReporting("2030-07-01")).toEqual([])
    const saved = await f.persisted()
    expect(Number((await f.client.executions.$post(request, options)).status)).toBe(200)
    expect(await f.persisted()).toEqual(saved)
    expect(
      await f.personnel(
        {
          kind: "corrected",
          correctsActionId: action.id,
          eventOn: restoreCalendarDate("2030-06-01"),
          reason: "Correct retirement date",
          replacementAction: {
            kind: "retired",
            employeeCode: "MANAGER-001",
            retirementOn: restoreCalendarDate("2030-07-31"),
          },
        },
        "reporting:correct-manager-exit",
        managerId,
      ),
    ).toMatchObject({ replayed: false })
    expect(await f.publicReporting("2030-07-31")).toHaveLength(1)
    expect(await f.publicReporting("2030-08-01")).toEqual([])
    expect(
      await f.personnel(
        {
          kind: "rehire",
          employeeCode: "MANAGER-001",
          eventOn: restoreCalendarDate("2030-09-01"),
          employmentType: "FULL_TIME",
        },
        "reporting:manager-rehire",
        managerId,
      ),
    ).toMatchObject({ replayed: false })
    expect(await f.publicReporting("2030-09-01")).toEqual([])
  })

  test("退職は独立した部下側の関係も閉じ、別上長と将来の交代予約を保つ", async () => {
    const f = await createCompanyAssignmentResourceTestContext()
    await f.initializeAssignment()
    await f.assignEmployeeCode(f.people[1]!.employeeId, "MANAGER-001")
    const relation = {
      organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
      type: "reporting-relation",
      id: "reporting:reserved",
      revision: 1,
      state: "active",
      effectiveFrom: "2030-03-01",
      effectiveTo: null,
      attributes: {
        employeeId: f.people[0]!.employeeId,
        managerEmployeeId: f.people[1]!.employeeId,
        organizationUnitId: "0190005f-0000-7000-8000-3e026079e0b5",
      },
    } satisfies NonNullable<Parameters<typeof f.write>[0]>[number]
    expect(
      Number(
        (
          await f.write(
            [
              relation,
              {
                ...relation,
                id: "reporting:other-report",
                attributes: { ...relation.attributes, employeeId: f.people[2]!.employeeId },
              },
              {
                ...relation,
                id: "reporting:parallel",
                attributes: { ...relation.attributes, managerEmployeeId: f.people[3]!.employeeId },
              },
            ],
            await f.companyRevision(),
            "reporting:independent-lines",
          )
        ).status,
      ),
    ).toBe(201)
    expect(
      Number(
        (
          await f.write(
            [
              {
                ...relation,
                revision: 2,
                effectiveFrom: "2030-09-01",
                attributes: { ...relation.attributes, managerEmployeeId: f.people[2]!.employeeId },
              },
            ],
            await f.companyRevision(),
            "reporting:future",
          )
        ).status,
      ),
    ).toBe(201)
    expect(
      await f.personnel(
        {
          kind: "retired",
          employeeCode: "MANAGER-001",
          retirementOn: restoreCalendarDate("2030-06-30"),
        },
        "reporting:retire-many",
        f.people[1]!.employeeId,
      ),
    ).toMatchObject({ replayed: false })
    expect(await f.publicReporting("2030-06-30")).toHaveLength(3)
    expect((await f.publicReporting("2030-07-01")).map((resource) => resource.id)).toEqual([
      "reporting:parallel",
    ])
    expect(
      (await f.publicReporting("2030-09-01"))
        .map((resource) => resource.readText("managerEmployeeId"))
        .sort(),
    ).toEqual([f.people[2]!.employeeId, f.people[3]!.employeeId].sort())
    const resolution = await new ResolveCanonicalOrganizationAuthorityAdapter({
      c: f.context,
      subjectEmployeeId: f.people[0]!.employeeId,
      criteria: [{ kind: "direct_manager" }],
      employeeRows: f.people.map((person) => ({ id: person.employeeId, code: null })),
      targetDepartmentCode: null,
      asOf: "2030-07-01",
    }).resolveCanonicalOrganizationAuthority()
    if (resolution instanceof Error) throw resolution
    expect(resolution.candidates.map((candidate) => candidate.employeeId)).toEqual([
      f.people[3]!.employeeId,
    ])
  })

  test("部下側の保存失敗は上長の退職も巻き戻し、後続の再割当は退職訂正で上書きしない", async () => {
    const f = await createCompanyAssignmentResourceTestContext()
    await f.initializeAssignment()
    await f.assignEmployeeCode(f.people[1]!.employeeId, "MANAGER-001")
    await f.assignEmployeeCode(f.people[2]!.employeeId, "MANAGER-002")
    const assignment = {
      kind: "manager_changed",
      employeeCode: "EMPLOYEE-001",
      eventOn: restoreCalendarDate("2030-03-01"),
      departmentCode: "TEAM",
      assignmentType: "primary",
      managerEmployeeCode: "MANAGER-001",
    } satisfies PersonnelActionInput
    expect(await f.personnel(assignment, "reporting:before-failure")).toMatchObject({
      replayed: false,
    })
    const retirement = {
      kind: "retired",
      employeeCode: "MANAGER-001",
      retirementOn: restoreCalendarDate("2030-06-30"),
    } satisfies PersonnelActionInput
    const before = await f.persisted()
    await execSql(
      f.database,
      "CREATE TRIGGER reject_manager_exit BEFORE INSERT ON company_resource_revisions WHEN NEW.resource_type = 'reporting-relation' BEGIN SELECT RAISE(ABORT, 'injected manager exit failure'); END;",
    )
    expect(
      await f.personnel(retirement, "reporting:exit-failure", f.people[1]!.employeeId),
    ).toBeInstanceOf(Error)
    expect(await f.persisted()).toEqual(before)
    await execSql(f.database, "DROP TRIGGER reject_manager_exit")
    const retired = await f.personnel(retirement, "reporting:exit-failure", f.people[1]!.employeeId)
    if (retired instanceof Error) throw retired
    expect(
      await f.personnel(
        {
          ...assignment,
          eventOn: restoreCalendarDate("2030-07-01"),
          managerEmployeeCode: "MANAGER-002",
        },
        "reporting:reassign",
      ),
    ).toMatchObject({ replayed: false })
    const reassigned = await f.persisted()
    expect(
      await f.personnel(
        {
          kind: "corrected",
          correctsActionId: retired.action.id,
          eventOn: restoreCalendarDate("2030-06-01"),
          reason: "Correct exit after reassignment",
          replacementAction: { ...retirement, retirementOn: restoreCalendarDate("2030-07-31") },
        },
        "reporting:stale-exit-correction",
        f.people[1]!.employeeId,
      ),
    ).toMatchObject({ code: "personnel_action_stale" })
    expect(await f.persisted()).toEqual(reassigned)
    expect(
      (await f.publicReporting("2030-07-15")).map((resource) =>
        resource.readText("managerEmployeeId"),
      ),
    ).toEqual([f.people[2]!.employeeId])
  })

  test("百件を超える部下側の関係も同じ退職のtransactionで終了する", async () => {
    const f = await createCompanyAssignmentResourceTestContext()
    await f.initializeAssignment()
    await f.assignEmployeeCode(f.people[1]!.employeeId, "MANAGER-001")
    const relations = Array.from(
      { length: 101 },
      (_, index) =>
        ({
          organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
          type: "reporting-relation",
          id: `reporting:many:${index}`,
          revision: 1,
          state: "active",
          effectiveFrom: "2030-03-01",
          effectiveTo: null,
          attributes: {
            employeeId: f.people[0]!.employeeId,
            managerEmployeeId: f.people[1]!.employeeId,
            organizationUnitId: "0190005f-0000-7000-8000-3e026079e0b5",
          },
        }) satisfies NonNullable<Parameters<typeof f.write>[0]>[number],
    )
    for (const [index, batch] of [relations.slice(0, 100), relations.slice(100)].entries())
      expect(
        Number(
          (await f.write(batch, await f.companyRevision(), `reporting:many-start:${index}`)).status,
        ),
      ).toBe(201)
    const companyRevision = await f.companyRevision()
    const retired = await f.personnel(
      {
        kind: "retired",
        employeeCode: "MANAGER-001",
        retirementOn: restoreCalendarDate("2030-06-30"),
      },
      "reporting:many-exit",
      f.people[1]!.employeeId,
    )
    if (retired instanceof Error) throw retired
    expect(await f.publicReporting("2030-06-30")).toHaveLength(101)
    expect(await f.publicReporting("2030-07-01")).toEqual([])
    expect(
      await f.database
        .prepare(
          "SELECT count(*) AS total FROM company_command_receipts WHERE substr(command_id, 1, length(?1)) = ?1",
        )
        .bind(`lifecycle:${retired.action.id}:`)
        .first<number>("total"),
    ).toBe(1)
    expect(await f.companyRevision()).toBe(companyRevision + 1)
    expect(
      await f.database
        .prepare("SELECT count(*) AS total FROM company_reporting_employment_violations")
        .first<number>("total"),
    ).toBe(0)
  })

  test("上長の退職準備中の部下側変更は競合にし、更新した版で再試行する", async () => {
    const f = await createCompanyAssignmentResourceTestContext()
    await f.initializeAssignment()
    await f.assignEmployeeCode(f.people[1]!.employeeId, "MANAGER-001")
    expect(
      await f.personnel(
        {
          kind: "manager_changed",
          employeeCode: "EMPLOYEE-001",
          eventOn: restoreCalendarDate("2030-03-01"),
          departmentCode: "TEAM",
          assignmentType: "primary",
          managerEmployeeCode: "MANAGER-001",
        },
        "reporting:race-start",
      ),
    ).toMatchObject({ replayed: false })
    const relation = (await f.publicReporting("2030-03-01"))[0]!
    const retirement = {
      kind: "retired",
      employeeCode: "MANAGER-001",
      retirementOn: restoreCalendarDate("2030-06-30"),
    } satisfies PersonnelActionInput
    const original = D1CompanyResourceRepository.prototype.findReportingRelationHistory
    const intercepted = spyOn(
      D1CompanyResourceRepository.prototype,
      "findReportingRelationHistory",
    ).mockImplementationOnce(async function (this: D1CompanyResourceRepository, ...args) {
      const history = await original.apply(this, args)
      expect(
        Number(
          (
            await f.write(
              [
                {
                  ...relation,
                  type: "reporting-relation",
                  revision: relation.revision + 1,
                  effectiveFrom: "2030-07-01",
                  attributes: {
                    employeeId: f.people[0]!.employeeId,
                    managerEmployeeId: f.people[2]!.employeeId,
                    organizationUnitId: "0190005f-0000-7000-8000-3e026079e0b5",
                  },
                },
              ],
              await f.companyRevision(),
              "reporting:race-reservation",
            )
          ).status,
        ),
      ).toBe(201)
      return history
    })
    try {
      expect(
        await f.personnel(retirement, "reporting:race-exit", f.people[1]!.employeeId),
      ).toMatchObject({ code: "personnel_action_stale" })
    } finally {
      intercepted.mockRestore()
    }
    expect(
      await f.database
        .prepare(
          "SELECT count(*) AS total FROM company_personnel_actions WHERE operation_id = 'reporting:race-exit'",
        )
        .first<number>("total"),
    ).toBe(0)
    expect(
      await f.personnel(retirement, "reporting:race-exit", f.people[1]!.employeeId),
    ).toMatchObject({ replayed: false })
    expect(
      (await f.publicReporting("2030-07-01")).map((resource) =>
        resource.readText("managerEmployeeId"),
      ),
    ).toEqual([f.people[2]!.employeeId])
  })

  test("公開APIも上長の雇用短縮だけを拒否し、関係の終了を同じcommandで確定する", async () => {
    const f = await createCompanyAssignmentResourceTestContext()
    await f.initializeAssignment()
    const managerId = f.people[1]!.employeeId
    const relation = {
      organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
      type: "reporting-relation",
      id: "reporting:employment-guard",
      revision: 1,
      state: "active",
      effectiveFrom: "2030-03-01",
      effectiveTo: null,
      attributes: {
        employeeId: f.people[0]!.employeeId,
        managerEmployeeId: managerId,
        organizationUnitId: "0190005f-0000-7000-8000-3e026079e0b5",
      },
    } satisfies NonNullable<Parameters<typeof f.write>[0]>[number]
    expect(
      Number(
        (await f.write([relation], await f.companyRevision(), "reporting:employment-start")).status,
      ),
    ).toBe(201)
    const snapshot = await new D1CompanyResourceRepository({ database: f.database }).findMany({
      organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
      types: ["employment", "collective-body-membership"],
    })
    if (!snapshot.ok) throw snapshot.cause
    const employment = snapshot.resources.find(
      (resource) => resource.type === "employment" && resource.readText("employeeId") === managerId,
    )
    if (employment === undefined) throw new Error("manager employment missing")
    const shortened = {
      ...employment,
      type: "employment",
      attributes: z
        .object({
          employeeId: z.string(),
          status: z.enum(["ACTIVE", "ON_LEAVE", "TERMINATED"]),
          employmentType: z.enum(["FULL_TIME", "PART_TIME"]),
        })
        .parse(employment.attributes),
      revision: employment.revision + 1,
      effectiveTo: "2030-07-01",
    } satisfies NonNullable<Parameters<typeof f.write>[0]>[number]
    const membership = snapshot.resources.find(
      (resource) =>
        resource.type === "collective-body-membership" &&
        resource.readText("employeeId") === managerId,
    )
    if (membership === undefined) throw new Error("manager membership missing")
    const endedMembership = {
      organizationId: membership.organizationId,
      type: "collective-body-membership",
      id: membership.id,
      revision: membership.revision + 1,
      state: "active",
      effectiveFrom: membership.effectiveFrom,
      effectiveTo: "2030-07-01",
      attributes: z
        .object({
          collectiveBodyId: z.string(),
          employeeId: z.string(),
          role: z.enum(["chair", "member", "secretary"]),
          voting: z.boolean(),
        })
        .parse(membership.attributes),
    } satisfies NonNullable<Parameters<typeof f.write>[0]>[number]
    const before = await f.persisted()
    expect(
      Number(
        (
          await f.client.employments.$post({
            header: {
              "idempotency-key": "reporting:shorten-only",
              "if-match": String(await f.companyRevision()),
              "x-company-organization-id": COMPANY_DEFAULT_ORGANIZATION_ID,
            },
            json: { reason: "Shorten employment", resources: [shortened] },
          })
        ).status,
      ),
    ).toBe(422)
    expect(await f.persisted()).toEqual(before)
    expect(
      Number(
        (
          await f.write(
            [shortened, { ...relation, revision: 2, effectiveTo: "2030-07-01" }],
            await f.companyRevision(),
            "reporting:membership-missing",
          )
        ).status,
      ),
    ).toBe(422)
    expect(await f.persisted()).toEqual(before)
    expect(
      Number(
        (
          await f.write(
            [shortened, endedMembership, { ...relation, revision: 2, effectiveTo: "2030-07-01" }],
            await f.companyRevision(),
            "reporting:shorten-together",
          )
        ).status,
      ),
    ).toBe(201)
    const saved = await f.persisted()
    expect(
      Number(
        (
          await f.write(
            [{ ...relation, revision: 3, effectiveFrom: "2030-06-01", effectiveTo: "2030-08-01" }],
            await f.companyRevision(),
            "reporting:invalid-expansion",
          )
        ).status,
      ),
    ).toBe(422)
    expect(await f.persisted()).toEqual(saved)
    expect(await f.publicReporting("2030-07-01")).toEqual([])
  })

  test("同じ組織の主務と兼務は別の直属上長を持ち、兼務終了では主務の上長を残す", async () => {
    const f = await createCompanyAssignmentResourceTestContext()
    await f.initializeAssignment()
    await f.assignEmployeeCode(f.people[1]!.employeeId, "MANAGER-001")
    await f.assignEmployeeCode(f.people[2]!.employeeId, "MANAGER-002")
    expect(
      await f.personnel(
        {
          kind: "manager_changed",
          employeeCode: "EMPLOYEE-001",
          eventOn: restoreCalendarDate("2030-03-01"),
          departmentCode: "TEAM",
          assignmentType: "primary",
          managerEmployeeCode: "MANAGER-001",
        },
        "reporting:primary-line",
      ),
    ).toMatchObject({ replayed: false })
    expect(
      await f.personnel(
        {
          kind: "concurrent_assignment_started",
          employeeCode: "EMPLOYEE-001",
          eventOn: restoreCalendarDate("2030-04-01"),
          departmentCode: "TEAM",
          positionTitle: "Reviewer",
          managerEmployeeCode: "MANAGER-002",
        },
        "reporting:concurrent-line",
      ),
    ).toMatchObject({ replayed: false })
    expect(
      (await f.publicReporting("2030-04-01"))
        .map((resource) => resource.readText("managerEmployeeId"))
        .toSorted((left, right) => (left ?? "").localeCompare(right ?? "")),
    ).toEqual([f.people[1]!.employeeId, f.people[2]!.employeeId].toSorted())
    expect(
      await f.personnel(
        {
          kind: "assignment_ended",
          employeeCode: "EMPLOYEE-001",
          eventOn: restoreCalendarDate("2030-05-01"),
          departmentCode: "TEAM",
          assignmentType: "concurrent",
        },
        "reporting:concurrent-end",
      ),
    ).toMatchObject({ replayed: false })
    expect(
      (await f.publicReporting("2030-05-01")).map((resource) =>
        resource.readText("managerEmployeeId"),
      ),
    ).toEqual([f.people[1]!.employeeId])
  })

  test("未接続所属の上長を役職変更で引き継ぎ、退職と再入社は別の雇用の関係にする", async () => {
    const f = await createCompanyAssignmentResourceTestContext()
    await f.assignEmployeeCode()
    await f.assignEmployeeCode(f.people[1]!.employeeId, "MANAGER-001")
    const revision = await f.database
      .prepare("SELECT revision FROM company_organization_lifecycle_states WHERE id = 1")
      .first<number>("revision")
    const code = await f.database
      .prepare(
        "SELECT code FROM company_organization_unit_period_versions WHERE organization_unit_id = ?1 LIMIT 1",
      )
      .bind(f.root.id)
      .first<string>("code")
    if (revision === null || code === null) throw new Error("organization missing")
    await f.database.batch([
      f.database
        .prepare(`INSERT INTO company_organization_change_operations
        (id, expected_revision, change_count, applied_count, resulting_revision, status, recorded_at)
        VALUES ('ea66152b-3d44-49e9-ad70-6a7b129d43ed', ?1, 1, 0, ?1 + 1, 'PENDING', 0)`)
        .bind(revision),
      f.database
        .prepare(`INSERT INTO company_organization_assignment_period_versions
        (period_id, revision, employment_id, employee_id, organization_unit_id, assignment_type, position_title,
          manager_employee_id, starts_on, ends_on, is_void, recorded_by_action_id, recorded_at)
        VALUES ('assignment:legacy-manager', 1, ?1, ?2, ?3, 'PRIMARY', 'Coordinator', ?4, '2030-01-01', NULL, 0, 'ea66152b-3d44-49e9-ad70-6a7b129d43ed', 0)`)
        .bind(
          f.assignment.attributes.employmentId,
          f.people[0]!.employeeId,
          f.root.id,
          f.people[1]!.employeeId,
        ),
      f.database.prepare(
        "UPDATE company_organization_change_operations SET status = 'COMPLETED' WHERE id = 'ea66152b-3d44-49e9-ad70-6a7b129d43ed'",
      ),
    ])
    expect(
      await f.personnel(
        {
          kind: "position_changed",
          employeeCode: "EMPLOYEE-001",
          eventOn: restoreCalendarDate("2030-03-01"),
          departmentCode: code,
          assignmentType: "primary",
          positionTitle: "Lead",
          changeType: "promotion",
        },
        "reporting:legacy-position",
      ),
    ).toMatchObject({ replayed: false })
    expect(await f.publicReporting("2030-02-28")).toEqual([])
    const first = (await f.publicReporting("2030-03-01"))[0]!
    expect(first.readText("managerEmployeeId")).toBe(f.people[1]!.employeeId)
    const beforeBackdate = await f.persisted()
    expect(
      Number(
        (
          await f.write(
            [
              {
                organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
                type: "reporting-relation",
                id: first.id,
                revision: first.revision + 1,
                state: "active",
                effectiveFrom: "2030-01-01",
                effectiveTo: null,
                attributes: {
                  employeeId: f.people[0]!.employeeId,
                  managerEmployeeId: f.people[1]!.employeeId,
                  organizationUnitId: f.root.id,
                },
              },
            ],
            await f.companyRevision(),
            "reporting:unadopted-past",
          )
        ).status,
      ),
    ).toBe(422)
    expect(await f.persisted()).toEqual(beforeBackdate)
    expect(
      await f.database
        .prepare(
          "SELECT manager_employee_id, ends_on FROM company_organization_assignment_period_versions WHERE period_id = 'assignment:legacy-manager' ORDER BY revision DESC LIMIT 1",
        )
        .first<{ manager_employee_id: string; ends_on: string }>(),
    ).toEqual({ manager_employee_id: f.people[1]!.employeeId, ends_on: "2030-03-01" })
    expect(
      await f.personnel(
        {
          kind: "retired",
          employeeCode: "EMPLOYEE-001",
          retirementOn: restoreCalendarDate("2030-06-30"),
        },
        "reporting:legacy-retire",
      ),
    ).toMatchObject({ replayed: false })
    expect(
      await f.personnel(
        {
          kind: "rehire",
          employeeCode: "EMPLOYEE-001",
          eventOn: restoreCalendarDate("2030-09-01"),
          employmentType: "PART_TIME",
          departmentCode: code,
          managerEmployeeCode: "MANAGER-001",
          positionTitle: "Coordinator",
        },
        "reporting:legacy-rehire",
      ),
    ).toMatchObject({ replayed: false })
    expect(await f.publicReporting("2030-08-01")).toEqual([])
    const second = (await f.publicReporting("2030-09-01"))[0]!
    expect(second.id).not.toBe(first.id)
    expect(second.readText("managerEmployeeId")).toBe(f.people[1]!.employeeId)
    expect(
      await f.database
        .prepare(
          "SELECT count(DISTINCT employment_id) AS count FROM company_personnel_reporting_bindings",
        )
        .first<number>("count"),
    ).toBe(2)
  })

  test("公開APIでも上長だけを所属期間外へ残せず、所属と上長の同時終了は確定できる", async () => {
    const f = await createCompanyAssignmentResourceTestContext()
    await f.initializeAssignment()
    await f.assignEmployeeCode(f.people[1]!.employeeId, "MANAGER-001")
    expect(
      await f.personnel(
        {
          kind: "manager_changed",
          employeeCode: "EMPLOYEE-001",
          eventOn: restoreCalendarDate("2030-03-01"),
          departmentCode: "TEAM",
          assignmentType: "primary",
          managerEmployeeCode: "MANAGER-001",
        },
        "reporting:coverage",
      ),
    ).toMatchObject({ replayed: false })
    const assignment = (await f.publicAssignments("2030-04-01"))[0]!
    const reporting = (await f.publicReporting("2030-04-01"))[0]!
    const end = {
      ...f.assignment,
      id: assignment.id,
      revision: assignment.revision + 1,
      effectiveFrom: assignment.effectiveFrom,
      effectiveTo: "2030-06-01",
      attributes: {
        ...f.assignment.attributes,
        organizationUnitId: "0190005f-0000-7000-8000-3e026079e0b5",
      },
    }
    const before = await f.persisted()
    expect(
      Number((await f.write([end], await f.companyRevision(), "reporting:uncovered-end")).status),
    ).toBe(422)
    expect(await f.persisted()).toEqual(before)
    const relation = {
      organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
      type: "reporting-relation",
      id: reporting.id,
      revision: reporting.revision + 1,
      state: "active",
      effectiveFrom: reporting.effectiveFrom,
      effectiveTo: "2030-06-01",
      attributes: {
        employeeId: f.people[0]!.employeeId,
        managerEmployeeId: f.people[1]!.employeeId,
        organizationUnitId: "0190005f-0000-7000-8000-3e026079e0b5",
      },
    } satisfies NonNullable<Parameters<typeof f.write>[0]>[number]
    expect(
      Number(
        (await f.write([end, relation], await f.companyRevision(), "reporting:covered-end")).status,
      ),
    ).toBe(201)
    expect(await f.publicAssignments("2030-06-01")).toEqual([])
    expect(await f.publicReporting("2030-06-01")).toEqual([])
    const saved = await f.persisted()
    expect(
      Number(
        (
          await f.write(
            [{ ...relation, revision: relation.revision + 1, effectiveTo: null }],
            await f.companyRevision(),
            "reporting:outside-assignment",
          )
        ).status,
      ),
    ).toBe(422)
    expect(await f.persisted()).toEqual(saved)
    expect(
      Number(
        (
          await f.write(
            [
              {
                ...relation,
                revision: relation.revision + 1,
                attributes: { ...relation.attributes, employeeId: f.people[2]!.employeeId },
              },
            ],
            await f.companyRevision(),
            "reporting:change-owner",
          )
        ).status,
      ),
    ).toBe(422)
    expect(await f.persisted()).toEqual(saved)
  })

  test("公開APIの将来上長を発令で保全し、後続の公開編集がある訂正を拒否する", async () => {
    const f = await createCompanyAssignmentResourceTestContext()
    await f.initializeAssignment()
    for (const index of [1, 2, 3])
      await f.assignEmployeeCode(f.people[index]!.employeeId, `MANAGER-00${index}`)
    const input = {
      kind: "manager_changed",
      employeeCode: "EMPLOYEE-001",
      eventOn: restoreCalendarDate("2030-03-01"),
      departmentCode: "TEAM",
      assignmentType: "primary",
      managerEmployeeCode: "MANAGER-001",
    } satisfies PersonnelActionInput
    expect(await f.personnel(input, "reporting:initial")).toMatchObject({ replayed: false })
    const first = (await f.publicReporting("2030-03-01"))[0]!
    const future = {
      organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
      type: "reporting-relation",
      id: first.id,
      revision: first.revision + 1,
      state: "active",
      effectiveFrom: "2030-07-01",
      effectiveTo: null,
      attributes: {
        employeeId: f.people[0]!.employeeId,
        managerEmployeeId: f.people[2]!.employeeId,
        organizationUnitId: "0190005f-0000-7000-8000-3e026079e0b5",
      },
    } satisfies NonNullable<Parameters<typeof f.write>[0]>[number]
    expect(
      Number((await f.write([future], await f.companyRevision(), "reporting:future")).status),
    ).toBe(201)
    const current = await f.personnel(
      { ...input, eventOn: restoreCalendarDate("2030-04-01"), managerEmployeeCode: "MANAGER-003" },
      "reporting:current",
    )
    if (current instanceof Error) throw current
    expect(current.action.summary).toMatchObject({
      previousManagerEmployeeCode: "MANAGER-001",
      managerEmployeeCode: "MANAGER-003",
    })
    for (const [date, index] of [
      ["2030-03-31", 1],
      ["2030-04-01", 3],
      ["2030-07-01", 2],
    ] satisfies Array<[string, number]>) {
      expect(
        (await f.publicReporting(date)).map((resource) => resource.readText("managerEmployeeId")),
      ).toEqual([f.people[index]!.employeeId])
    }
    const head = await f.database
      .prepare(
        "SELECT revision FROM company_resource_heads WHERE resource_type = 'reporting-relation' AND resource_id = ?1",
      )
      .bind(first.id)
      .first<number>("revision")
    if (head === null) throw new Error("reporting head missing")
    expect(
      Number(
        (
          await f.write(
            [{ ...future, revision: head + 1, effectiveFrom: "2030-05-01" }],
            await f.companyRevision(),
            "reporting:external-edit",
          )
        ).status,
      ),
    ).toBe(201)
    const before = await f.persisted()
    expect(
      await f.personnel(
        {
          kind: "corrected",
          correctsActionId: current.action.id,
          eventOn: restoreCalendarDate("2030-06-01"),
          reason: "Correct earlier manager",
          replacementAction: { ...input, eventOn: restoreCalendarDate("2030-04-15") },
        },
        "reporting:conflicting-correction",
      ),
    ).toMatchObject({ code: "personnel_action_stale" })
    expect(await f.persisted()).toEqual(before)
  })

  test("同じ直属上長への競合は一方だけ確定し、再試行と再送で履歴を重複させない", async () => {
    const f = await createCompanyAssignmentResourceTestContext()
    await f.initializeAssignment()
    await f.assignEmployeeCode(f.people[1]!.employeeId, "MANAGER-001")
    await f.assignEmployeeCode(f.people[2]!.employeeId, "MANAGER-002")
    const inputs = ["MANAGER-001", "MANAGER-002"].map(
      (managerEmployeeCode) =>
        ({
          kind: "manager_changed",
          employeeCode: "EMPLOYEE-001",
          eventOn: restoreCalendarDate("2030-03-01"),
          departmentCode: "TEAM",
          assignmentType: "primary",
          managerEmployeeCode,
        }) satisfies PersonnelActionInput,
    )
    const results = await Promise.all(
      inputs.map((input, index) => f.personnel(input, `reporting:race:${index}`)),
    )
    expect(results.filter((result) => !(result instanceof Error))).toHaveLength(1)
    const rejected = results.findIndex((result) => result instanceof Error)
    expect(await f.personnel(inputs[rejected]!, `reporting:race:${rejected}`)).toMatchObject({
      replayed: false,
    })
    const applied = await f.persisted()
    expect(await f.personnel(inputs[rejected]!, `reporting:race:${rejected}`)).toMatchObject({
      replayed: true,
    })
    expect(await f.persisted()).toEqual(applied)
    expect(
      (await f.publicReporting("2030-03-01")).map((resource) =>
        resource.readText("managerEmployeeId"),
      ),
    ).toEqual([f.people[rejected + 1]!.employeeId])
    expect(
      await f.database
        .prepare("SELECT count(*) AS count FROM company_personnel_reporting_bindings")
        .first<number>("count"),
    ).toBe(1)
  })

  test("上長変更を公開履歴へ保存し、役職変更と独立した複数上長を保全する", async () => {
    const f = await createCompanyAssignmentResourceTestContext()
    await f.initializeAssignment()
    const manager = f.people[1]!
    const additional = f.people[2]!
    await f.assignEmployeeCode(manager.employeeId, "MANAGER-001")
    const input = {
      kind: "manager_changed",
      employeeCode: "EMPLOYEE-001",
      eventOn: restoreCalendarDate("2030-03-01"),
      departmentCode: "TEAM",
      assignmentType: "primary",
      managerEmployeeCode: "MANAGER-001",
    } satisfies PersonnelActionInput
    const before = await f.persisted()
    await execSql(
      f.database,
      "CREATE TRIGGER reject_reporting_binding BEFORE INSERT ON company_personnel_reporting_bindings BEGIN SELECT RAISE(ABORT, 'injected reporting binding failure'); END;",
    )
    expect(await f.personnel(input, "reporting:start")).toBeInstanceOf(Error)
    expect(await f.persisted()).toEqual(before)
    await execSql(f.database, "DROP TRIGGER reject_reporting_binding")
    expect(await f.personnel(input, "reporting:start")).toMatchObject({ replayed: false })
    const saved = await f.persisted()
    expect(await f.personnel(input, "reporting:start")).toMatchObject({ replayed: true })
    expect(await f.persisted()).toEqual(saved)
    expect(await f.publicReporting("2030-02-28")).toEqual([])
    const relation = (await f.publicReporting("2030-03-01"))[0]!
    expect(relation.readText("managerEmployeeId")).toBe(manager.employeeId)
    expect(
      Number(
        (
          await f.write(
            [
              {
                organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
                type: "reporting-relation",
                id: "reporting:independent",
                revision: 1,
                state: "active",
                effectiveFrom: "2030-01-01",
                effectiveTo: null,
                attributes: {
                  employeeId: f.people[0]!.employeeId,
                  managerEmployeeId: additional.employeeId,
                  organizationUnitId: "0190005f-0000-7000-8000-3e026079e0b5",
                },
              },
            ],
            await f.companyRevision(),
            "reporting:independent",
          )
        ).status,
      ),
    ).toBe(201)
    expect(
      await f.personnel(
        {
          kind: "position_changed",
          employeeCode: "EMPLOYEE-001",
          eventOn: restoreCalendarDate("2030-04-01"),
          departmentCode: "TEAM",
          assignmentType: "primary",
          positionTitle: "Lead",
          changeType: "promotion",
        },
        "reporting:position",
      ),
    ).toMatchObject({ replayed: false })
    expect(
      (await f.publicReporting("2030-04-01"))
        .map((resource) => resource.readText("managerEmployeeId"))
        .sort((left, right) => (left ?? "").localeCompare(right ?? "")),
    ).toEqual([manager.employeeId, additional.employeeId].sort())
    const resolution = await new ResolveCanonicalOrganizationAuthorityAdapter({
      c: f.context,
      subjectEmployeeId: f.people[0]!.employeeId,
      criteria: [{ kind: "direct_manager" }],
      employeeRows: f.people.map((person) => ({ id: person.employeeId, code: null })),
      targetDepartmentCode: null,
      asOf: "2030-04-01",
    }).resolveCanonicalOrganizationAuthority()
    if (resolution instanceof Error) throw resolution
    expect(resolution.candidates.map((candidate) => candidate.employeeId).sort()).toEqual(
      [manager.employeeId, additional.employeeId].sort(),
    )
    expect(
      await f.database
        .prepare(
          "SELECT count(*) AS count FROM company_organization_assignment_period_versions WHERE manager_employee_id IS NOT NULL",
        )
        .first<number>("count"),
    ).toBe(0)
  })

  test("上長変更の訂正で発効前を復元し、退職で対応する指揮命令を終了する", async () => {
    const f = await createCompanyAssignmentResourceTestContext()
    await f.initializeAssignment()
    await f.assignEmployeeCode(f.people[1]!.employeeId, "MANAGER-001")
    const input = {
      kind: "manager_changed",
      employeeCode: "EMPLOYEE-001",
      eventOn: restoreCalendarDate("2030-03-01"),
      departmentCode: "TEAM",
      assignmentType: "primary",
      managerEmployeeCode: "MANAGER-001",
    } satisfies PersonnelActionInput
    const original = await f.personnel(input, "reporting:original")
    if (original instanceof Error) throw original
    const corrected = await f.personnel(
      {
        kind: "corrected",
        correctsActionId: original.action.id,
        eventOn: restoreCalendarDate("2030-06-01"),
        reason: "Correct manager effective date",
        replacementAction: { ...input, eventOn: restoreCalendarDate("2030-04-01") },
      },
      "reporting:correct",
    )
    if (corrected instanceof Error) throw corrected
    expect(corrected).toMatchObject({ replayed: false })
    expect(await f.publicReporting("2030-03-15")).toEqual([])
    expect(
      (await f.publicReporting("2030-04-01")).map((resource) =>
        resource.readText("managerEmployeeId"),
      ),
    ).toEqual([f.people[1]!.employeeId])
    expect(
      await f.personnel(
        {
          kind: "retired",
          employeeCode: "EMPLOYEE-001",
          retirementOn: restoreCalendarDate("2030-06-30"),
        },
        "reporting:retire",
      ),
    ).toMatchObject({ replayed: false })
    expect(await f.publicReporting("2030-06-30")).toHaveLength(1)
    expect(await f.publicReporting("2030-07-01")).toEqual([])
  })

  test("公開履歴の過去と発令後の上長を合わせた循環を拒否し、履歴読取失敗も巻き戻す", async () => {
    const f = await createCompanyAssignmentResourceTestContext()
    await f.initializeAssignment()
    await f.assignEmployeeCode(f.people[1]!.employeeId, "MANAGER-001")
    const backward = {
      organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
      type: "reporting-relation",
      id: "reporting:backward",
      revision: 1,
      state: "active",
      effectiveFrom: "2030-01-01",
      effectiveTo: null,
      attributes: {
        employeeId: f.people[1]!.employeeId,
        managerEmployeeId: f.people[0]!.employeeId,
        organizationUnitId: "0190005f-0000-7000-8000-3e026079e0b5",
      },
    } satisfies NonNullable<Parameters<typeof f.write>[0]>[number]
    expect(
      Number((await f.write([backward], await f.companyRevision(), "reporting:backward")).status),
    ).toBe(201)
    expect(
      Number(
        (
          await f.write(
            [{ ...backward, revision: 2, state: "void", effectiveFrom: "2030-07-01" }],
            await f.companyRevision(),
            "reporting:future-end",
          )
        ).status,
      ),
    ).toBe(201)
    const input = {
      kind: "manager_changed",
      employeeCode: "EMPLOYEE-001",
      eventOn: restoreCalendarDate("2030-03-01"),
      departmentCode: "TEAM",
      assignmentType: "primary",
      managerEmployeeCode: "MANAGER-001",
    } satisfies PersonnelActionInput
    const before = await f.persisted()
    expect(await f.personnel(input, "reporting:cycle")).toBeInstanceOf(Error)
    expect(await f.persisted()).toEqual(before)
    const reader = spyOn(
      D1CompanyResourceRepository.prototype,
      "findReportingRelationHistory",
    ).mockResolvedValue(new Error("injected reporting read failure"))
    try {
      expect(
        await f.personnel(
          { ...input, eventOn: restoreCalendarDate("2030-08-01") },
          "reporting:retry",
        ),
      ).toBeInstanceOf(Error)
      expect(await f.persisted()).toEqual(before)
    } finally {
      reader.mockRestore()
    }
    expect(
      await f.personnel(
        { ...input, eventOn: restoreCalendarDate("2030-08-01") },
        "reporting:retry",
      ),
    ).toMatchObject({ replayed: false })
  })

  test("主務を変えない兼務の追加も公開し、保存失敗と再送で所属を重複させない", async () => {
    const f = await createCompanyAssignmentResourceTestContext()
    await f.initializeAssignment()
    const code = await f.database
      .prepare(
        "SELECT code FROM company_organization_unit_period_versions WHERE organization_unit_id = ?1 LIMIT 1",
      )
      .bind(f.root.id)
      .first<string>("code")
    if (code === null) throw new Error("root code missing")
    const input = {
      kind: "concurrent_assignment_started",
      employeeCode: "EMPLOYEE-001",
      eventOn: restoreCalendarDate("2030-04-01"),
      departmentCode: code,
      positionTitle: "Coordinator",
      managerEmployeeCode: null,
    } satisfies PersonnelActionInput
    const before = await f.persisted()
    await execSql(
      f.database,
      "CREATE TRIGGER reject_new_assignment_binding BEFORE INSERT ON company_assignment_period_bindings BEGIN SELECT RAISE(ABORT, 'injected assignment binding failure'); END;",
    )
    expect(await f.personnel(input, "personnel:first-concurrent")).toBeInstanceOf(Error)
    expect(await f.persisted()).toEqual(before)
    await execSql(f.database, "DROP TRIGGER reject_new_assignment_binding")
    expect(await f.personnel(input, "personnel:first-concurrent")).toMatchObject({
      replayed: false,
    })
    expect(
      (await f.publicAssignments("2030-03-01")).map((resource) =>
        resource.readText("assignmentType"),
      ),
    ).toEqual(["PRIMARY"])
    expect(
      (await f.publicAssignments("2030-04-01"))
        .map((resource) => resource.readText("assignmentType"))
        .sort((left, right) => (left ?? "").localeCompare(right ?? "")),
    ).toEqual(["CONCURRENT", "PRIMARY"])
    const applied = await f.persisted()
    expect(await f.personnel(input, "personnel:first-concurrent")).toMatchObject({ replayed: true })
    expect(await f.persisted()).toEqual(applied)
  })
  test("組織番号の将来変更後も、配属時と同じ組織IDで役職を変更する", async () => {
    const f = await createCompanyAssignmentResourceTestContext()
    await f.initializeAssignment()
    const unit = {
      organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
      type: "organization-unit",
      revision: 1,
      state: "active",
      effectiveFrom: "2030-01-01",
      effectiveTo: null,
      attributes: {
        organizationUnitId: "0190005f-0000-7000-8000-3e026079e0b5",
        code: "TEAM",
        officialName: "Example Team",
        kind: "TEAM",
        parentOrganizationUnitId: f.root.id,
      },
    } satisfies Omit<
      Extract<NonNullable<Parameters<typeof f.write>[0]>[number], { type: "organization-unit" }>,
      "id"
    >
    expect(
      Number(
        (
          await f.write(
            [
              {
                ...unit,
                id: "0190005f-0000-7000-8000-0e0100000008",
                revision: 2,
                effectiveTo: "2030-07-01",
              },
              {
                ...unit,
                id: "0190005f-0000-7000-8000-0e010000000a",
                effectiveFrom: "2030-07-01",
                attributes: { ...unit.attributes, code: "TEAM-NEW" },
              },
            ],
            await f.companyRevision(),
            "0190005f-0000-7000-8000-9b1a68be40a1",
          )
        ).status,
      ),
    ).toBe(201)
    expect(
      await f.personnel(
        {
          kind: "position_changed",
          employeeCode: "EMPLOYEE-001",
          eventOn: restoreCalendarDate("2030-08-01"),
          departmentCode: "TEAM-NEW",
          assignmentType: "primary",
          positionTitle: "Lead",
          changeType: "promotion",
        },
        "personnel:renamed-unit",
      ),
    ).toMatchObject({ replayed: false })
    expect(
      (await f.publicAssignments("2030-08-01")).map((resource) => ({
        unit: resource.readText("organizationUnitId"),
        title: resource.readText("positionTitle"),
      })),
    ).toEqual([{ unit: "0190005f-0000-7000-8000-3e026079e0b5", title: "Lead" }])
    expect(await f.read("2030-08-01")).toMatchObject({
      primaryAssignment: {
        organizationUnitId: "0190005f-0000-7000-8000-3e026079e0b5",
        positionTitle: "Lead",
      },
    })
  })
  test("異動先の組織IDと将来予約の境界を公開履歴へ保つ", async () => {
    const f = await createCompanyAssignmentResourceTestContext()
    const source = await f.initializeAssignment()
    expect(
      Number(
        (
          await f.write(
            [
              {
                organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
                type: "organization-unit",
                id: "0190005f-0000-7000-8000-0e0100000004",
                revision: 1,
                state: "active",
                effectiveFrom: "2030-01-01",
                effectiveTo: null,
                attributes: {
                  organizationUnitId: "0190005f-0000-7000-8000-35e18215e902",
                  code: "OTHER",
                  officialName: "Other Team",
                  kind: "TEAM",
                  parentOrganizationUnitId: f.root.id,
                },
              },
              {
                ...source,
                revision: 2,
                effectiveFrom: "2030-07-01",
                attributes: { ...source.attributes, positionTitle: "Future" },
              },
            ],
            await f.companyRevision(),
            "future-transfer",
          )
        ).status,
      ),
    ).toBe(201)
    expect(
      await f.personnel(
        {
          kind: "transferred",
          employeeCode: "EMPLOYEE-001",
          eventOn: restoreCalendarDate("2030-03-01"),
          departmentCode: "OTHER",
          positionTitle: "Temporary Lead",
          managerEmployeeCode: null,
        },
        "personnel:transfer",
      ),
    ).toMatchObject({ replayed: false })
    for (const [date, unit] of [
      ["2030-02-01", "0190005f-0000-7000-8000-3e026079e0b5"],
      ["2030-04-01", "0190005f-0000-7000-8000-35e18215e902"],
      ["2030-08-01", "0190005f-0000-7000-8000-3e026079e0b5"],
    ] satisfies Array<[string, string]>) {
      expect(
        (await f.publicAssignments(date)).map((resource) =>
          resource.readText("organizationUnitId"),
        ),
      ).toEqual([unit])
      expect(await f.read(date)).toMatchObject({ primaryAssignment: { organizationUnitId: unit } })
    }
  })

  test("最新の公開版が取消でも将来の所属を孤立させる雇用取消は保存しない", async () => {
    const f = await createCompanyAssignmentResourceTestContext()
    const source = await f.initializeAssignment()
    expect(
      Number(
        (
          await f.write(
            [{ ...source, revision: 2, effectiveFrom: "2030-07-01" }],
            await f.companyRevision(),
            "future-employment-reference",
          )
        ).status,
      ),
    ).toBe(201)
    expect(
      await f.personnel(
        {
          kind: "position_changed",
          employeeCode: "EMPLOYEE-001",
          eventOn: restoreCalendarDate("2030-03-01"),
          departmentCode: "TEAM",
          assignmentType: "primary",
          positionTitle: "Lead",
          changeType: "promotion",
        },
        "personnel:reference",
      ),
    ).toMatchObject({ replayed: false })
    expect(
      await f.database
        .prepare(
          "SELECT count(*) FROM company_resource_heads WHERE resource_type = 'assignment' AND state = 'active'",
        )
        .first<number>("count(*)"),
    ).toBe(0)
    const employment = await f.database
      .prepare(`SELECT revision, effective_from, attributes_json FROM company_resource_heads
      WHERE resource_type = 'employment' AND resource_id = ?1`)
      .bind(source.attributes.employmentId)
      .first<{ revision: number; effective_from: string; attributes_json: string }>()
    if (employment === null) throw new Error("employment missing")
    const change = CompanyResourceChangeEntity.create({
      commandId: "orphan-employment",
      expectedRevision: await f.companyRevision(),
      actorAccountId: f.creator.accountId,
      reason: "Withdraw employment",
      recordedAt: f.at.getTime(),
      resources: [
        {
          organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
          type: "employment",
          id: source.attributes.employmentId,
          revision: employment.revision + 1,
          state: "void",
          effectiveFrom: restoreCalendarDate(employment.effective_from),
          effectiveTo: null,
          attributes: z.record(z.string(), z.json()).parse(JSON.parse(employment.attributes_json)),
        },
      ],
    })
    if (change instanceof Error) throw change
    const before = await f.persisted()
    expect(
      await new D1CompanyResourceRepository({ database: f.database }).write(change),
    ).toMatchObject({
      kind: "invalid",
    })
    expect(await f.persisted()).toEqual(before)
    expect(await f.read("2030-08-01")).toMatchObject({
      primaryAssignment: { organizationUnitId: "0190005f-0000-7000-8000-3e026079e0b5" },
    })
  })

  test("会社直下の公開所属も人事発令で終了できる", async () => {
    const f = await createCompanyAssignmentResourceTestContext()
    await f.assignEmployeeCode()
    expect(
      Number((await f.write([f.assignment], await f.companyRevision(), "root-start")).status),
    ).toBe(201)
    const code = await f.database
      .prepare(
        "SELECT code FROM company_organization_unit_period_versions WHERE organization_unit_id = ?1 ORDER BY revision DESC LIMIT 1",
      )
      .bind(f.root.id)
      .first<string>("code")
    if (code === null) throw new Error("root code missing")
    expect(
      await f.personnel(
        {
          kind: "assignment_ended",
          employeeCode: "EMPLOYEE-001",
          eventOn: restoreCalendarDate("2030-04-01"),
          departmentCode: code,
          assignmentType: "primary",
        },
        "personnel:root-end",
      ),
    ).toMatchObject({ replayed: false })
    expect(await f.publicAssignments("2030-04-01")).toEqual([])
  })

  test("同じ所属への競合発令は片方だけ確定する", async () => {
    const f = await createCompanyAssignmentResourceTestContext()
    await f.initializeAssignment()
    const results = await Promise.all(
      ["2030-04-01", "2030-05-01"].map((date) =>
        f.personnel(
          {
            kind: "assignment_ended",
            employeeCode: "EMPLOYEE-001",
            eventOn: restoreCalendarDate(date),
            departmentCode: "TEAM",
            assignmentType: "primary",
          },
          `personnel:race:${date}`,
        ),
      ),
    )
    expect(results.filter((result) => !(result instanceof Error))).toHaveLength(1)
    expect(results.filter((result) => result instanceof Error)).toMatchObject([
      { code: "personnel_action_stale" },
    ])
    expect(
      await f.database
        .prepare(
          "SELECT count(*) FROM company_personnel_actions WHERE operation_id LIKE 'personnel:race:%'",
        )
        .first<number>("count(*)"),
    ).toBe(1)
  })

  test("将来の所属予約を保った役職変更と訂正を公開履歴へ反映する", async () => {
    const f = await createCompanyAssignmentResourceTestContext()
    const source = await f.initializeAssignment()
    expect(
      Number(
        (
          await f.write(
            [
              {
                ...source,
                revision: 2,
                effectiveFrom: "2030-07-01",
                attributes: { ...source.attributes, positionTitle: "Future" },
              },
            ],
            await f.companyRevision(),
            "future",
          )
        ).status,
      ),
    ).toBe(201)
    expect(
      await f.personnel(
        {
          kind: "position_changed",
          employeeCode: "EMPLOYEE-001",
          eventOn: restoreCalendarDate("2030-03-01"),
          departmentCode: "TEAM",
          assignmentType: "primary",
          positionTitle: "Lead",
          changeType: "promotion",
        },
        "personnel:planned",
      ),
    ).toMatchObject({ replayed: false })
    for (const [date, title] of [
      ["2030-02-01", "Coordinator"],
      ["2030-04-01", "Lead"],
      ["2030-08-01", "Future"],
    ] satisfies Array<[string, string]>) {
      expect(
        (await f.publicAssignments(date)).map((resource) => resource.readText("positionTitle")),
      ).toEqual([title])
      expect(await f.read(date)).toMatchObject({ primaryAssignment: { positionTitle: title } })
    }
    const actionId = await f.database
      .prepare("SELECT id FROM company_personnel_actions WHERE operation_id = 'personnel:planned'")
      .first<string>("id")
    if (actionId === null) throw new Error("personnel action missing")
    expect(
      await f.personnel(
        {
          kind: "corrected",
          correctsActionId: actionId,
          eventOn: restoreCalendarDate("2030-06-01"),
          reason: "Correct confirmed promotion date",
          replacementAction: {
            kind: "position_changed",
            employeeCode: "EMPLOYEE-001",
            eventOn: restoreCalendarDate("2030-04-01"),
            departmentCode: "TEAM",
            assignmentType: "primary",
            positionTitle: "Corrected Lead",
            changeType: "promotion",
          },
        },
        "personnel:correct-planned",
      ),
    ).toMatchObject({ replayed: false })
    for (const [date, title] of [
      ["2030-03-15", "Coordinator"],
      ["2030-05-01", "Corrected Lead"],
      ["2030-08-01", "Future"],
    ] satisfies Array<[string, string]>) {
      expect(
        (await f.publicAssignments(date)).map((resource) => resource.readText("positionTitle")),
      ).toEqual([title])
      expect(await f.read(date)).toMatchObject({ primaryAssignment: { positionTitle: title } })
    }
  })

  test("公開所属の保存失敗で発令も履歴も残さず、同じキーで再試行する", async () => {
    const f = await createCompanyAssignmentResourceTestContext()
    await f.initializeAssignment()
    const input: PersonnelActionInput = {
      kind: "assignment_ended",
      employeeCode: "EMPLOYEE-001",
      eventOn: restoreCalendarDate("2030-04-01"),
      departmentCode: "TEAM",
      assignmentType: "primary",
    }
    const before = await f.persisted()
    const beforeActions = await f.database
      .prepare("SELECT count(*) FROM company_personnel_actions")
      .first<number>("count(*)")
    await execSql(
      f.database,
      `CREATE TRIGGER fail_assignment_binding BEFORE UPDATE ON company_assignment_resource_bindings
      BEGIN SELECT RAISE(ABORT, 'injected assignment journal failure'); END;`,
    )
    expect(await f.personnel(input, "personnel:retry")).toBeInstanceOf(Error)
    expect(await f.persisted()).toEqual(before)
    expect(
      await f.database
        .prepare("SELECT count(*) FROM company_personnel_actions")
        .first<number>("count(*)"),
    ).toBe(beforeActions)
    expect(
      (await f.publicAssignments("2030-05-01")).map((resource) =>
        resource.readText("positionTitle"),
      ),
    ).toEqual(["Coordinator"])
    await execSql(f.database, "DROP TRIGGER fail_assignment_binding")
    expect(await f.personnel(input, "personnel:retry")).toMatchObject({ replayed: false })
    expect(await f.publicAssignments("2030-05-01")).toEqual([])
    const after = await f.persisted()
    expect(await f.personnel(input, "personnel:retry")).toMatchObject({ replayed: true })
    expect(await f.persisted()).toEqual(after)
  })
  test("公開所属への発令と公開APIの再更新を往復し、退職時も両方の期間を閉じる", async () => {
    const f = await createCompanyAssignmentResourceTestContext()
    expect(
      Number(
        (
          await f.write([
            {
              organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
              type: "organization-unit",
              id: "0190005f-0000-7000-8000-0e0100000008",
              revision: 1,
              state: "active",
              effectiveFrom: "2030-01-01",
              effectiveTo: null,
              attributes: {
                organizationUnitId: "0190005f-0000-7000-8000-3e026079e0b5",
                code: "TEAM",
                officialName: "Example Team",
                kind: "TEAM",
                parentOrganizationUnitId: f.root.id,
              },
            },
          ])
        ).status,
      ),
    ).toBe(201)
    await f.assignEmployeeCode()
    expect(
      Number(
        (
          await f.write(
            [
              {
                ...f.assignment,
                attributes: {
                  ...f.assignment.attributes,
                  organizationUnitId: "0190005f-0000-7000-8000-3e026079e0b5",
                },
              },
            ],
            await f.companyRevision(),
            "public-start",
          )
        ).status,
      ),
    ).toBe(201)
    const input: PersonnelActionInput = {
      kind: "position_changed",
      employeeCode: "EMPLOYEE-001",
      eventOn: restoreCalendarDate("2030-03-01"),
      departmentCode: "TEAM",
      assignmentType: "primary",
      positionTitle: "Lead",
      changeType: "promotion",
    }
    expect(await f.personnel(input, "personnel:position")).toMatchObject({ replayed: false })
    const after = await f.persisted()
    expect(await f.personnel(input, "personnel:position")).toMatchObject({ replayed: true })
    expect(await f.persisted()).toEqual(after)
    for (const [date, title] of [
      ["2030-02-01", "Coordinator"],
      ["2030-04-01", "Lead"],
    ]) {
      expect(
        (await f.publicAssignments(date!)).map((resource) => resource.readText("positionTitle")),
      ).toEqual([title])
      expect(await f.read(date!)).toMatchObject({ primaryAssignment: { positionTitle: title } })
    }
    const current = (await f.publicAssignments("2030-04-01"))[0]
    if (current === undefined) throw new Error("public assignment missing")
    expect(
      Number(
        (
          await f.write(
            [
              {
                ...f.assignment,
                id: current.id,
                revision: current.revision + 1,
                effectiveFrom: current.effectiveFrom,
                attributes: {
                  ...f.assignment.attributes,
                  organizationUnitId: "0190005f-0000-7000-8000-3e026079e0b5",
                  positionTitle: "Revised Lead",
                },
              },
            ],
            await f.companyRevision(),
            "public-revised",
          )
        ).status,
      ),
    ).toBe(201)
    expect(await f.read("2030-04-01")).toMatchObject({
      primaryAssignment: { positionTitle: "Revised Lead" },
    })
    expect(
      await f.personnel(
        {
          kind: "retired",
          employeeCode: "EMPLOYEE-001",
          retirementOn: restoreCalendarDate("2030-06-30"),
        },
        "personnel:retire",
      ),
    ).toMatchObject({ replayed: false })
    expect(
      (await f.publicAssignments("2030-06-30")).map((resource) =>
        resource.readText("positionTitle"),
      ),
    ).toEqual(["Revised Lead"])
    expect(await f.publicAssignments("2030-07-01")).toEqual([])
    expect(await f.read("2030-07-01")).toMatchObject({ primaryAssignment: null })
  })
  test("公開APIで作った組織へ人事発令で配属し、実際の組織IDを保つ", async () => {
    const f = await createCompanyAssignmentResourceTestContext()
    expect(
      Number(
        (
          await f.write([
            {
              organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
              type: "organization-unit",
              id: "0190005f-0000-7000-8000-0e0100000009",
              revision: 1,
              state: "active",
              effectiveFrom: "2030-01-01",
              effectiveTo: null,
              attributes: {
                organizationUnitId: "0190005f-0000-7000-8000-e384a7defa99",
                code: "TEAM",
                officialName: "Example Team",
                kind: "TEAM",
                parentOrganizationUnitId: f.root.id,
              },
            },
          ])
        ).status,
      ),
    ).toBe(201)
    await f.assignEmployeeCode()
    const employee = await f.read("2030-06-01")
    if (employee === null || employee instanceof Error || employee.employeeCode === null)
      throw new Error("employee code missing")
    expect(
      await f.personnel(
        {
          kind: "primary_assignment_started",
          employeeCode: employee.employeeCode,
          eventOn: restoreCalendarDate("2030-01-01"),
          departmentCode: "TEAM",
          positionTitle: "Coordinator",
          managerEmployeeCode: null,
        },
        "personnel:opaque",
      ),
    ).toMatchObject({ replayed: false })
    expect(await f.read("2030-06-01")).toMatchObject({
      primaryAssignment: { organizationUnitId: "0190005f-0000-7000-8000-e384a7defa99" },
    })
    expect(
      (await f.publicAssignments("2030-06-01")).map((resource) =>
        resource.readText("organizationUnitId"),
      ),
    ).toEqual(["0190005f-0000-7000-8000-e384a7defa99"])
  })
  test("公開APIに保存した所属が同じ基準日の従業員一覧へ届く", async () => {
    const f = await createCompanyAssignmentResourceTestContext()
    expect(Number((await f.write()).status)).toBe(201)
    expect(await f.read("2029-12-31")).toMatchObject({ primaryAssignment: null })
    expect(await f.read("2030-06-01")).toMatchObject({
      primaryAssignment: { organizationUnitId: f.root.id, positionTitle: "Coordinator" },
    })
  })
  test("将来予約・過去訂正・空白・取消を公開履歴と同じ所属期間へ投影する", async () => {
    const f = await createCompanyAssignmentResourceTestContext()
    const future = {
      ...f.assignment,
      revision: 2,
      effectiveFrom: "2030-07-01",
      attributes: { ...f.assignment.attributes, positionTitle: "Future" },
    }
    const earlier = {
      ...f.assignment,
      revision: 3,
      effectiveFrom: "2030-03-01",
      effectiveTo: "2030-05-01",
      attributes: { ...f.assignment.attributes, positionTitle: "Earlier correction" },
    }
    for (const [index, resource] of [f.assignment, future, earlier].entries())
      expect(
        Number((await f.write([resource], f.revision + index, `history-${index}`)).status),
      ).toBe(201)
    for (const [date, title] of [
      ["2030-02-01", "Coordinator"],
      ["2030-04-01", "Earlier correction"],
      ["2030-06-01", null],
      ["2030-08-01", "Future"],
    ] satisfies Array<[string, string | null]>) {
      const employee = await f.read(date)
      if (employee instanceof Error) throw employee
      expect(employee?.primaryAssignment?.positionTitle ?? null).toBe(title)
    }
    const beforeReplay = await f.persisted()
    expect(Number((await f.write([earlier], f.revision + 2, "history-2")).status)).toBe(200)
    expect(await f.persisted()).toEqual(beforeReplay)
    expect(
      Number(
        (await f.write([{ ...future, revision: 4, state: "void" }], f.revision + 3, "void-future"))
          .status,
      ),
    ).toBe(201)
    expect(await f.read("2030-08-01")).toMatchObject({ primaryAssignment: null })
    expect(await f.read("2030-02-01")).toMatchObject({
      primaryAssignment: { positionTitle: "Coordinator" },
    })
  })

  test("組織の作成と配属を一つの変更で保存し、主務の重複は全体を巻き戻す", async () => {
    const f = await createCompanyAssignmentResourceTestContext()
    const unit = {
      organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
      type: "organization-unit",
      id: "0190005f-0000-7000-8000-0e010000000b",
      revision: 1,
      state: "active",
      effectiveFrom: "2030-01-01",
      effectiveTo: null,
      attributes: {
        organizationUnitId: "0190005f-0000-7000-8000-a43705386391",
        code: "TEAM",
        officialName: "Example Team",
        kind: "TEAM",
        parentOrganizationUnitId: f.root.id,
      },
    } satisfies NonNullable<Parameters<typeof f.write>[0]>[number]
    const assignment = {
      ...f.assignment,
      attributes: {
        ...f.assignment.attributes,
        organizationUnitId: "0190005f-0000-7000-8000-a43705386391",
      },
    }
    expect(Number((await f.write([unit, assignment])).status)).toBe(201)
    expect(await f.read("2030-06-01")).toMatchObject({
      primaryAssignment: { organizationUnitId: "0190005f-0000-7000-8000-a43705386391" },
    })
    const before = await f.persisted()
    const duplicate = { ...f.assignment, id: "assignment:duplicate" }
    expect(Number((await f.write([duplicate], f.revision + 1, "duplicate")).status)).toBe(422)
    expect(await f.persisted()).toEqual(before)
  })

  test("競合した所属変更は一つだけ確定し、更新した版で再試行できる", async () => {
    const f = await createCompanyAssignmentResourceTestContext()
    expect(Number((await f.write()).status)).toBe(201)
    const responses = await Promise.all(
      ["First", "Second"].map((positionTitle) =>
        f.write(
          [
            {
              ...f.assignment,
              revision: 2,
              attributes: { ...f.assignment.attributes, positionTitle },
            },
          ],
          f.revision + 1,
          `race-${positionTitle}`,
        ),
      ),
    )
    expect(
      responses.map((response) => Number(response.status)).toSorted((left, right) => left - right),
    ).toEqual([201, 409])
    expect(
      Number(
        (
          await f.write(
            [
              {
                ...f.assignment,
                revision: 3,
                attributes: { ...f.assignment.attributes, positionTitle: "Retried" },
              },
            ],
            f.revision + 2,
            "retry",
          )
        ).status,
      ),
    ).toBe(201)
    expect(await f.read("2030-06-01")).toMatchObject({
      primaryAssignment: { positionTitle: "Retried" },
    })
  })

  test("所属履歴の読取前に別変更が確定しても入力不正とせず競合を返す", async () => {
    const f = await createCompanyAssignmentResourceTestContext()
    expect(Number((await f.write()).status)).toBe(201)
    const pending = {
      ...f.assignment,
      revision: 2,
      attributes: { ...f.assignment.attributes, positionTitle: "Retried" },
    }
    const historyRead = spyOn(
      CompanyAssignmentResourceHistoryAdapter.prototype,
      "read",
    ).mockImplementationOnce(async (resource) => {
      historyRead.mockRestore()
      expect(
        Number(
          (
            await f.write(
              [
                {
                  ...pending,
                  attributes: { ...pending.attributes, positionTitle: "Winner" },
                },
              ],
              f.revision + 1,
              "winner",
            )
          ).status,
        ),
      ).toBe(201)
      return new CompanyAssignmentResourceHistoryAdapter(f.database).read(resource)
    })
    try {
      expect(Number((await f.write([pending], f.revision + 1, "pending")).status)).toBe(409)
    } finally {
      historyRead.mockRestore()
    }
    expect(await f.persisted()).toMatchObject({ company_revision: f.revision + 2 })
    expect(await f.read("2030-06-01")).toMatchObject({
      primaryAssignment: { positionTitle: "Winner" },
    })
    expect(
      Number((await f.write([{ ...pending, revision: 3 }], f.revision + 2, "pending")).status),
    ).toBe(201)
    expect(await f.read("2030-06-01")).toMatchObject({
      primaryAssignment: { positionTitle: "Retried" },
    })
  })

  test("履歴を読めない場合は変更を保存せず、再試行で一度だけ確定する", async () => {
    const f = await createCompanyAssignmentResourceTestContext()
    const before = await f.persisted()
    const unavailable = spyOn(
      CompanyAssignmentResourceHistoryAdapter.prototype,
      "read",
    ).mockResolvedValue(new Error("history unavailable"))
    try {
      expect(Number((await f.write()).status)).toBe(503)
      expect(await f.persisted()).toEqual(before)
    } finally {
      unavailable.mockRestore()
    }
    expect(Number((await f.write()).status)).toBe(201)
    const after = await f.persisted()
    expect(Number((await f.write()).status)).toBe(200)
    expect(await f.persisted()).toEqual(after)
  })

  test("期間台帳だけを更新する操作は公開所属を置き去りにできない", async () => {
    const f = await createCompanyAssignmentResourceTestContext()
    expect(Number((await f.write()).status)).toBe(201)
    const before = await f.persisted()
    const failure = await f.database
      .batch([
        f.database
          .prepare(`INSERT INTO company_organization_change_operations
        (id, expected_revision, change_count, applied_count, resulting_revision, status, recorded_at, actor_account_id, reason)
        SELECT '6d2e8f41-7a3b-4c9d-8e15-3f0a9b7c2d64', revision, 1, 0, revision + 1, 'PENDING', 0, ?1, 'Unmirrored assignment change'
        FROM company_organization_lifecycle_states WHERE id = 1`)
          .bind(f.creator.accountId),
        f.database.prepare(`INSERT INTO company_organization_assignment_period_versions
        (period_id, revision, employment_id, employee_id, organization_unit_id, assignment_type, position_title,
         manager_employee_id, starts_on, ends_on, is_void, recorded_by_action_id, recorded_at)
        SELECT period_id, revision + 1, employment_id, employee_id, organization_unit_id, assignment_type, 'Unmirrored',
          manager_employee_id, starts_on, ends_on, is_void, '6d2e8f41-7a3b-4c9d-8e15-3f0a9b7c2d64', 0
        FROM company_organization_assignment_period_versions WHERE revision = 1`),
        f.database.prepare(
          "UPDATE company_organization_change_operations SET status = 'COMPLETED' WHERE id = '6d2e8f41-7a3b-4c9d-8e15-3f0a9b7c2d64'",
        ),
      ])
      .then(
        () => null,
        (cause: unknown) => cause,
      )
    expect(failure).toBeInstanceOf(Error)
    expect(failure).toMatchObject({
      message: expect.stringContaining("organization assignment source is stale"),
    })
    expect(await f.persisted()).toEqual(before)
    expect(await f.read("2030-06-01")).toMatchObject({
      primaryAssignment: { positionTitle: "Coordinator" },
    })
  })
})
