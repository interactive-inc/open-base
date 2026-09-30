import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { expect, setDefaultTimeout, test } from "bun:test"
import { ReadWorkforceBaselineStatesAdapter } from "@/contexts/company/infrastructure/adapters/workforce/read-workforce-baseline-states.adapter"
import { createLocalD1Database } from "@system/test/local-d1/create-local-d1-database.test-support"
import { restoreWorkforceId } from "@/contexts/company/domain/definitions/restore-workforce-id.definition"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

async function fixture(status: string) {
  const database = await createLocalD1Database({
    schema: `CREATE TABLE company_personnel_actions (
    id TEXT, employee_id TEXT, kind TEXT, event_on TEXT, recorded_at INTEGER, summary_json TEXT
  );`,
  })
  return {
    database,
    async seed() {
      await database
        .prepare(`INSERT INTO company_personnel_actions VALUES
      ('active', 'employee:active', 'initial_state', '2026-01-01', 0, '{"status":"active"}'),
      ('closed', 'employee:closed', 'initial_state', '2026-01-01', 0, ?1)`)
        .bind(JSON.stringify({ status }))
        .run()
    },
  }
}

test.each(["retired", "terminated"])(
  "保存済みの退職初期状態 %s を復元し、在籍者の参照を妨げない",
  async (status) => {
    const context = await fixture(status)
    await context.seed()
    const before = (
      await context.database.prepare("SELECT * FROM company_personnel_actions ORDER BY id").all()
    ).results
    const states = await new ReadWorkforceBaselineStatesAdapter(
      context.database,
    ).readWorkforceBaselineStates()
    expect(states.size).toBe(1)
    expect(states.get(restoreWorkforceId("employee", "employee:closed"))).toEqual({
      asOf: restoreCalendarDate("2026-01-01"),
      status: "TERMINATED",
    })
    expect(states.has(restoreWorkforceId("employee", "employee:active"))).toBe(false)
    expect(
      (await context.database.prepare("SELECT * FROM company_personnel_actions ORDER BY id").all())
        .results,
    ).toEqual(before)
  },
)

test("未知の初期状態を退職や在籍へ読み替えない", async () => {
  const context = await fixture("unknown")
  await context.seed()
  const result = await new ReadWorkforceBaselineStatesAdapter(context.database)
    .readWorkforceBaselineStates()
    .catch((cause: unknown) => cause)
  expect(result).toBeInstanceOf(Error)
})
