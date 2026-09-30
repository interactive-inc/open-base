import { expect, setDefaultTimeout, test } from "bun:test"
import { createCompanyGradeAssignmentTestContext } from "@/contexts/company/test/company-grade-assignment.test-support"
import { DirectPersonnelActionAdapter } from "@/contexts/company/infrastructure/adapters/employee-lifecycle/direct-personnel-action.adapter"
import { EmployeeLifecycleAdapter } from "@/contexts/company/infrastructure/adapters/employee-lifecycle/employee-lifecycle.adapter"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

async function fixture() {
  const f = await createCompanyGradeAssignmentTestContext()
  const employeeId = f.people[0]!.employeeId
  const context = { ...f.context, env: { ...f.context.env, NOW: "2030-06-01T00:00:00Z" } }
  const revisions = await new EmployeeLifecycleAdapter(context).loadRevisions(employeeId)
  if (revisions instanceof Error) throw revisions
  const command = {
    session: {
      accountId: zAccountId.parse(f.creator.accountId),
      employeeId,
      hasPermission: (permission: string) => permission === "employee:lifecycle:apply",
    },
    employeeId,
    idempotencyKey: "company-snapshot:retire",
    expectedEmployeeRevision: revisions.employeeRevision,
    expectedOrganizationRevision: revisions.organizationRevision,
    expectedCompanyRevision: await f.companyRevision(),
    input: {
      kind: "retired" as const,
      employeeCode: "EMPLOYEE-001",
      retirementOn: restoreCalendarDate("2030-06-30"),
    },
  }
  return { ...f, command, adapter: new DirectPersonnelActionAdapter(context) }
}

test("確認済み会社版の変更で人事発令全体を拒否し、同じ確認条件の再送だけを許可する", async () => {
  const f = await fixture()
  const before = await f.persisted()
  for (const revision of [-1, 0.5, f.command.expectedCompanyRevision - 1]) {
    expect(
      await f.adapter.apply({ ...f.command, expectedCompanyRevision: revision }),
    ).toBeInstanceOf(Error)
    expect(await f.persisted()).toEqual(before)
  }
  const applied = await f.adapter.apply(f.command)
  if (applied instanceof Error) throw applied
  expect(applied.replayed).toBe(false)
  const after = await f.persisted()
  expect(await f.adapter.apply(f.command)).toMatchObject({
    replayed: true,
    action: { id: applied.action.id },
  })
  expect(
    await f.adapter.apply({ ...f.command, expectedCompanyRevision: await f.companyRevision() }),
  ).toMatchObject({ code: "idempotency_conflict" })
  expect(await f.adapter.apply({ ...f.command, expectedCompanyRevision: undefined })).toMatchObject(
    { code: "idempotency_conflict" },
  )
  expect(await f.persisted()).toEqual(after)
  const audit = await f.database
    .prepare(
      "SELECT metadata_json FROM system_audit_events WHERE target_id = ? AND action = 'employee.lifecycle.applied' ORDER BY occurred_at DESC LIMIT 1",
    )
    .bind(String(f.command.employeeId))
    .first<{ metadata_json: string }>()
  expect(JSON.parse(audit?.metadata_json ?? "null")).toMatchObject({
    expectedCompanyRevision: f.command.expectedCompanyRevision,
  })
})

test("保存準備後の会社版変更でも発令・雇用・等級・監査を確定しない", async () => {
  const f = await fixture()
  const originalPrepare = f.database.prepare.bind(f.database)
  const originalBatch = f.database.batch.bind(f.database)
  const guards = new WeakSet<D1PreparedStatement>()
  const persistedWithAudit = async () => ({
    state: await f.persisted(),
    audit: (await f.database.prepare("SELECT * FROM system_audit_events ORDER BY event_id").all())
      .results,
  })
  let beforeCommit: Awaited<ReturnType<typeof persistedWithAudit>> | undefined
  let injected = false
  f.database.prepare = (sql) => {
    const statement = originalPrepare(sql)
    if (
      sql.includes("THEN 1 ELSE json_extract('', '$') END") &&
      sql.includes("company_organizations")
    ) {
      const bind = statement.bind.bind(statement)
      statement.bind = (...values: unknown[]) => {
        const bound = bind(...values)
        guards.add(bound)
        return bound
      }
    }
    return statement
  }
  f.database.batch = async (statements) => {
    if (!injected && statements.some((statement) => guards.has(statement))) {
      injected = true
      expect(
        Number(
          (
            await f.write(
              [
                {
                  ...f.grade,
                  id: "grade:concurrent",
                  attributes: { ...f.grade.attributes, code: "CONCURRENT" },
                },
              ],
              f.command.expectedCompanyRevision,
              "company-snapshot:concurrent",
            )
          ).status,
        ),
      ).toBe(201)
      beforeCommit = await persistedWithAudit()
    }
    return originalBatch(statements)
  }
  try {
    expect(await f.adapter.apply(f.command)).toMatchObject({ code: "personnel_action_stale" })
    expect(injected).toBe(true)
    if (beforeCommit === undefined) throw new Error("Concurrent write was not injected")
    expect(await persistedWithAudit()).toEqual(beforeCommit)
    expect(await f.read("2030-07-01")).toHaveLength(1)
  } finally {
    f.database.prepare = originalPrepare
    f.database.batch = originalBatch
  }
})
