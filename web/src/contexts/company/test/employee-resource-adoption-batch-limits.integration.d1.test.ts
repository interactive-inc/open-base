import { execSql } from "@system/test/local-d1/exec-sql.test-support"
import { expect, setDefaultTimeout, spyOn, test } from "bun:test"
import { z } from "zod"
import {
  batchEmployeeId,
  createEmployeeAdoptionBatchFixture,
} from "@/contexts/company/test/employee-resource-adoption-batch.test-support"
import { EmployeeResourceAdoptionSnapshotAdapter } from "@/contexts/company/infrastructure/adapters/employee-resource-adoption/employee-resource-adoption-snapshot.adapter"
import { CompanyValidationError } from "@/contexts/company/domain/errors"
import { EMPLOYEE_RESOURCE_ADOPTION_BATCH_MAX_BYTES } from "@/contexts/company/domain/catalogs/employee-resource-adoption-batch-limit.catalog"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

test("大きい確認履歴を複数SQLへ分けても最後の証跡失敗で全件取り消し、DBの文字列・bind上限内で再試行する", async () => {
  const context = await createEmployeeAdoptionBatchFixture(10, 95)
  const input = await context.input()
  const before = await context.state()
  await execSql(
    context.database,
    `CREATE TRIGGER fail_last_payload BEFORE INSERT ON company_employee_resource_adoptions
    WHEN NEW.employee_id = '${batchEmployeeId(9)}' BEGIN SELECT RAISE(ABORT, 'last payload failed'); END`,
  )
  const intercepted = spyOn(context.database, "batch")
  try {
    expect((await context.post(input)).status).toBe(503)
    expect(intercepted).toHaveBeenCalledTimes(1)
    expect(intercepted.mock.calls[0]![0].length).toBeGreaterThan(6)
  } finally {
    intercepted.mockRestore()
  }
  expect(await context.state()).toEqual(before)
  await execSql(context.database, "DROP TRIGGER fail_last_payload")
  const prepare = context.database.prepare.bind(context.database)
  const bindings: Array<ReadonlyArray<unknown>> = []
  const statements = spyOn(context.database, "prepare").mockImplementation((sql) => {
    expect(new TextEncoder().encode(sql).length).toBeLessThanOrEqual(100_000)
    const statement = prepare(sql)
    const bind = statement.bind.bind(statement)
    spyOn(statement, "bind").mockImplementation((...values) => {
      bindings.push(values)
      return bind(...values)
    })
    return statement
  })
  try {
    expect((await context.post(input)).status).toBe(200)
    expect(statements.mock.calls.length).toBeLessThan(40)
    expect(
      bindings.some((values) =>
        values.some(
          (value) =>
            typeof value === "string" && new TextEncoder().encode(value).length > 1_000_000,
        ),
      ),
    ).toBe(true)
    for (const values of bindings) {
      expect(values.length).toBeLessThanOrEqual(100)
      for (const value of values) {
        if (typeof value === "string")
          expect(new TextEncoder().encode(value).length).toBeLessThanOrEqual(1_750_000)
      }
    }
  } finally {
    statements.mockRestore()
  }
  expect((await context.state())[3]).toHaveLength(10)
}, 30_000)

test("確認履歴の合計が上限を超える依頼は保存を始めず拒否し、上限ちょうどは読める", async () => {
  // 8MBの確認履歴をローカルD1へ入れずに、同じSQLの合計判定を小さい上限で確かめる。
  const context = await createEmployeeAdoptionBatchFixture(3, 2)
  const input = await context.input()
  const sources = await new EmployeeResourceAdoptionSnapshotAdapter(context.database).findMany(
    context.employees.map((employee) => employee.employeeId),
  )
  if (sources instanceof Error) throw sources
  const total = sources.reduce(
    (bytes, snapshot) => bytes + new TextEncoder().encode(snapshot.props.sourceJson).length,
    0,
  )
  const ids = context.employees.map((employee) => employee.employeeId)
  expect(
    await new EmployeeResourceAdoptionSnapshotAdapter(context.database).findMany(ids, total),
  ).toHaveLength(ids.length)
  const tooLarge = await new EmployeeResourceAdoptionSnapshotAdapter(context.database).findMany(
    ids,
    total - 1,
  )
  expect(tooLarge).toBeInstanceOf(CompanyValidationError)
  expect((tooLarge as CompanyValidationError).code).toBe(
    "employee_resource_adoption_batch_too_large",
  )

  const before = await context.state()
  // 実際の合計判定のSQLを、ここだけ小さい上限で動かす。
  const adapter = new EmployeeResourceAdoptionSnapshotAdapter(context.database)
  // spyの前に束縛し、元の読取を呼ぶ。
  const read = adapter.findMany.bind(adapter)
  const limited = spyOn(
    EmployeeResourceAdoptionSnapshotAdapter.prototype,
    "findMany",
  ).mockImplementation((employeeIds) => read(employeeIds, total - 1))
  const intercepted = spyOn(context.database, "batch")
  try {
    const response = await context.post(input)
    expect(response.status).toBe(422)
    expect(
      z
        .object({ code: z.string() })
        .strict()
        .parse(await response.json()),
    ).toEqual({ code: "employee_resource_adoption_batch_too_large" })
    expect(intercepted).not.toHaveBeenCalled()
  } finally {
    intercepted.mockRestore()
    limited.mockRestore()
  }
  expect(await context.state()).toEqual(before)
  expect(EMPLOYEE_RESOURCE_ADOPTION_BATCH_MAX_BYTES).toBe(8_000_000)
})
