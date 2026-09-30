import { execSql } from "@system/test/local-d1/exec-sql.test-support"
import { describe, expect, setDefaultTimeout, spyOn, test } from "bun:test"
import { z } from "zod"
import { createCompanyAssignmentResourceTestContext } from "@/contexts/company/test/company-assignment-resource.test-support"
import { EmployeeLifecycleAdapter } from "@/contexts/company/infrastructure/adapters/employee-lifecycle/employee-lifecycle.adapter"
import { PersonnelActionPersistenceAdapter } from "@/contexts/company/infrastructure/adapters/employee-lifecycle/personnel-action-persistence.adapter"
import { PersonnelActionCompletionPreparationAdapter } from "@/contexts/company/infrastructure/adapters/employee-lifecycle/personnel-action-completion-preparation.adapter"
import { fingerprintPersonnelAction } from "@/contexts/company/domain/definitions/fingerprint-personnel-action.definition"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

async function fixture() {
  const base = await createCompanyAssignmentResourceTestContext()
  await base.assignEmployeeCode()
  const managerId = base.people[1]!.employeeId
  await base.assignEmployeeCode(managerId, "MANAGER-001")
  const revision = await base.database
    .prepare("SELECT revision FROM company_organization_lifecycle_states WHERE id = 1")
    .first<number>("revision")
  const code = await base.database
    .prepare(
      "SELECT code FROM company_organization_unit_period_versions WHERE organization_unit_id = ?1 LIMIT 1",
    )
    .bind(base.root.id)
    .first<string>("code")
  if (revision === null || code === null) throw new Error("organization missing")
  await base.database.batch([
    base.database
      .prepare(`INSERT INTO company_organization_change_operations
      (id, expected_revision, change_count, applied_count, resulting_revision, status, recorded_at)
      VALUES ('58d585a9-e426-485a-82a9-51843a004ecf', ?1, 1, 0, ?1 + 1, 'PENDING', 0)`)
      .bind(revision),
    base.database
      .prepare(`INSERT INTO company_organization_assignment_period_versions
      (period_id, revision, employment_id, employee_id, organization_unit_id, assignment_type,
        position_title, manager_employee_id, starts_on, ends_on, is_void, recorded_by_action_id, recorded_at)
      VALUES ('assignment:legacy-manager-retirement', 1, ?1, ?2, ?3, 'PRIMARY', 'Coordinator', ?4,
        '2030-01-01', NULL, 0, '58d585a9-e426-485a-82a9-51843a004ecf', 0)`)
      .bind(
        base.assignment.attributes.employmentId,
        base.people[0]!.employeeId,
        base.root.id,
        managerId,
      ),
    base.database.prepare(
      "UPDATE company_organization_change_operations SET status = 'COMPLETED' WHERE id = '58d585a9-e426-485a-82a9-51843a004ecf'",
    ),
  ])
  const lifecycle = new EmployeeLifecycleAdapter(base.context)
  const request = async () => {
    const revisions = await lifecycle.loadRevisions(managerId)
    if (revisions instanceof Error) throw revisions
    return {
      json: {
        action: {
          kind: "retired",
          employeeCode: "MANAGER-001",
          retirementOn: restoreCalendarDate("2030-06-30"),
        },
        expected_company_revision: await base.companyRevision(),
        expected_employee_revision: revisions.employeeRevision,
        expected_organization_revision: revisions.organizationRevision,
      },
    } satisfies Parameters<typeof base.client.executions.$post>[0]
  }
  const assignments = async () => {
    const schedule = await lifecycle.loadSchedule(base.people[0]!.employeeId)
    if (schedule instanceof Error) throw schedule
    return schedule.assignments.map((period) => ({
      startsOn: period.startsOn,
      endsOn: period.endsOn,
      managerEmployeeId: period.managerEmployeeId,
      positionTitle: period.positionTitle,
    }))
  }
  return { ...base, managerId, request, assignments, code }
}

describe("未接続所属を持つ上長の退職保存", () => {
  test("APIから退職・再送・訂正・再入社しても部下の所属と過去の上長を保全する", async () => {
    const context = await fixture()
    const request = await context.request()
    const options = { headers: { "idempotency-key": "legacy:manager-exit" } }
    const response = await context.client.executions.$post(request, options)
    expect(Number(response.status)).toBe(201)
    const action = z.object({ id: z.string() }).parse(await response.json())
    expect(await context.assignments()).toEqual([
      {
        startsOn: "2030-01-01",
        endsOn: "2030-07-01",
        managerEmployeeId: context.managerId,
        positionTitle: "Coordinator",
      },
      {
        startsOn: "2030-07-01",
        endsOn: null,
        managerEmployeeId: null,
        positionTitle: "Coordinator",
      },
    ])
    expect(await context.publicAssignments("2030-07-01")).toEqual([])
    expect(await context.publicReporting("2030-07-01")).toEqual([])
    const saved = await context.persisted()
    expect(Number((await context.client.executions.$post(request, options)).status)).toBe(200)
    expect(await context.persisted()).toEqual(saved)
    expect(
      await context.personnel(
        {
          kind: "corrected",
          correctsActionId: action.id,
          eventOn: restoreCalendarDate("2030-06-01"),
          reason: "Confirm corrected retirement date",
          replacementAction: {
            kind: "retired",
            employeeCode: "MANAGER-001",
            retirementOn: restoreCalendarDate("2030-07-31"),
          },
        },
        "legacy:manager-exit-correction",
        context.managerId,
      ),
    ).toMatchObject({ replayed: false })
    expect(await context.assignments()).toEqual([
      {
        startsOn: "2030-01-01",
        endsOn: "2030-08-01",
        managerEmployeeId: context.managerId,
        positionTitle: "Coordinator",
      },
      {
        startsOn: "2030-08-01",
        endsOn: null,
        managerEmployeeId: null,
        positionTitle: "Coordinator",
      },
    ])
    expect(
      await context.personnel(
        {
          kind: "rehire",
          employeeCode: "MANAGER-001",
          eventOn: restoreCalendarDate("2030-09-01"),
          employmentType: "FULL_TIME",
        },
        "legacy:manager-rehire",
        context.managerId,
      ),
    ).toMatchObject({ replayed: false })
    expect((await context.assignments()).at(-1)?.managerEmployeeId).toBeNull()
  })

  test("部下側の保存失敗では雇用・発令・公開履歴・再送結果も残さない", async () => {
    const context = await fixture()
    const before = await context.persisted()
    const assignments = await context.assignments()
    await execSql(
      context.database,
      `CREATE TRIGGER reject_legacy_manager_exit
      BEFORE INSERT ON company_organization_assignment_period_versions
      BEGIN SELECT RAISE(ABORT, 'injected dependent assignment failure'); END;`,
    )
    const request = await context.request()
    const options = { headers: { "idempotency-key": "legacy:failed-exit" } }
    expect(Number((await context.client.executions.$post(request, options)).status)).toBe(503)
    expect(await context.persisted()).toEqual(before)
    expect(await context.assignments()).toEqual(assignments)
    await execSql(context.database, "DROP TRIGGER reject_legacy_manager_exit")
    expect(Number((await context.client.executions.$post(request, options)).status)).toBe(201)
  })

  test("部下が後から編集した所属を退職訂正で上書きしない", async () => {
    const context = await fixture()
    const response = await context.client.executions.$post(await context.request(), {
      headers: { "idempotency-key": "legacy:exit-before-edit" },
    })
    expect(Number(response.status)).toBe(201)
    const action = z.object({ id: z.string() }).parse(await response.json())
    expect(
      await context.personnel(
        {
          kind: "position_changed",
          employeeCode: "EMPLOYEE-001",
          eventOn: restoreCalendarDate("2030-09-01"),
          departmentCode: context.code,
          assignmentType: "primary",
          positionTitle: "Lead",
          changeType: "promotion",
        },
        "legacy:later-worker-edit",
      ),
    ).toMatchObject({ replayed: false })
    const before = await context.persisted()
    expect(
      await context.personnel(
        {
          kind: "corrected",
          correctsActionId: action.id,
          eventOn: restoreCalendarDate("2030-06-01"),
          reason: "Recheck date",
          replacementAction: {
            kind: "retired",
            employeeCode: "MANAGER-001",
            retirementOn: restoreCalendarDate("2030-07-31"),
          },
        },
        "legacy:stale-correction",
        context.managerId,
      ),
    ).toMatchObject({ code: "personnel_action_stale" })
    expect(await context.persisted()).toEqual(before)
  })

  test("承認済み発令の準備にも同じ上長終了を含め、古い組織版では準備しない", async () => {
    const context = await fixture()
    const request = await context.request()
    const before = await context.persisted()
    const command = {
      session: {
        accountId: context.creator.accountId,
        employeeId: context.creator.employeeId,
        hasPermission: () => true,
      },
      employeeId: context.managerId,
      input: request.json.action,
      sourceApplicationId: 1,
      requestedByEmployeeId: context.creator.employeeId,
      expectedEmployeeRevision: request.json.expected_employee_revision,
      expectedOrganizationRevision: request.json.expected_organization_revision,
      expectedPayloadFingerprint: await fingerprintPersonnelAction(
        context.managerId,
        request.json.action,
      ),
    }
    const adapter = new PersonnelActionCompletionPreparationAdapter(context.context)
    const prepared = await adapter.prepare(command)
    if (prepared instanceof Error) throw prepared
    expect(
      prepared.persistence.projection.mutations
        .filter((mutation) => mutation.periodType === "assignment")
        .map((mutation) => [
          mutation.after.employeeId,
          mutation.after.startsOn,
          mutation.after.endsOn,
          mutation.after.managerEmployeeId,
        ]),
    ).toEqual([
      [context.creator.employeeId, "2030-01-01", "2030-07-01", context.managerId],
      [context.creator.employeeId, "2030-07-01", null, null],
    ])
    expect(
      await adapter.prepare({
        ...command,
        expectedOrganizationRevision: command.expectedOrganizationRevision - 1,
      }),
    ).toMatchObject({ code: "personnel_action_stale" })
    expect(await context.persisted()).toEqual(before)
  })

  test("部下の同時編集が先に確定したら退職全体を拒否し、再確認後に再試行できる", async () => {
    const context = await fixture()
    const original = PersonnelActionPersistenceAdapter.prototype.write
    const intercepted = spyOn(
      PersonnelActionPersistenceAdapter.prototype,
      "write",
    ).mockImplementationOnce(async function (this: PersonnelActionPersistenceAdapter, props) {
      expect(
        await context.personnel(
          {
            kind: "position_changed",
            employeeCode: "EMPLOYEE-001",
            eventOn: restoreCalendarDate("2030-09-01"),
            departmentCode: context.code,
            assignmentType: "primary",
            positionTitle: "Lead",
            changeType: "promotion",
          },
          "legacy:raced-worker-edit",
        ),
      ).toMatchObject({ replayed: false })
      return original.call(this, props)
    })
    const retirement = {
      kind: "retired",
      employeeCode: "MANAGER-001",
      retirementOn: restoreCalendarDate("2030-06-30"),
    } satisfies Parameters<typeof context.personnel>[0]
    try {
      expect(
        await context.personnel(retirement, "legacy:raced-exit", context.managerId),
      ).toMatchObject({ code: "personnel_action_stale" })
    } finally {
      intercepted.mockRestore()
    }
    expect(
      await context.database
        .prepare(
          "SELECT count(*) FROM company_personnel_actions WHERE operation_id = 'legacy:raced-exit'",
        )
        .first<number>("count(*)"),
    ).toBe(0)
    expect(
      await context.personnel(retirement, "legacy:raced-exit", context.managerId),
    ).toMatchObject({ replayed: false })
    expect((await context.assignments()).at(-1)?.positionTitle).toBe("Lead")
  })
})
