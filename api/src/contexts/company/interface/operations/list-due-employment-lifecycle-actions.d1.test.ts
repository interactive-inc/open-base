import { execSql } from "@system/test/local-d1/exec-sql.test-support"
import { listDueEmploymentLifecycleActions } from "@/contexts/company/interface/operations/list-due-employment-lifecycle-actions"
import { createLocalD1Database } from "@system/test/local-d1/create-local-d1-database.test-support"
import { describe, expect, setDefaultTimeout, test } from "bun:test"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

async function createDatabase(): Promise<D1Database> {
  const database = await createLocalD1Database({ schema: "" })
  await execSql(
    database,
    `CREATE TABLE company_personnel_actions (
    id TEXT PRIMARY KEY, kind TEXT NOT NULL, event_on TEXT NOT NULL,
    recorded_at INTEGER NOT NULL, payload_fingerprint TEXT NOT NULL, summary_json TEXT NOT NULL)`,
  )
  const insert = database.prepare(
    "INSERT INTO company_personnel_actions VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
  )
  const rows: ReadonlyArray<[string, string, string, number, string]> = [
    ["hire-due", "hire", "2026-09-01", 100, "{}"],
    ["transfer", "transfer", "2026-09-01", 100, "{}"],
    ["hire-future", "hire", "2026-10-01", 100, "{}"],
    ["retired-last-day", "retired", "2026-09-10", 100, "{}"],
    ["retired-day-before", "retired", "2026-09-09", 100, "{}"],
    ["rehire-before-window", "rehire", "2026-09-01", 50, "{}"],
    [
      "corrected-retired-due",
      "corrected",
      "2026-09-01",
      100,
      '{"replacementKind":"retired","replacementEventOn":"2026-09-09"}',
    ],
    [
      "corrected-hire-future",
      "corrected",
      "2026-09-01",
      100,
      '{"replacementKind":"hire","replacementEventOn":"2026-10-01"}',
    ],
    ["corrected-void", "corrected", "2026-09-01", 100, '{"replacementKind":"hire"}'],
    ["corrected-transfer", "corrected", "2026-09-01", 100, '{"replacementKind":"transfer"}'],
  ]
  for (const [id, kind, eventOn, recordedAt, summary] of rows)
    await insert.bind(id, kind, eventOn, recordedAt, `fingerprint:${id}`, summary).run()
  return database
}

const window = { recordedFrom: 60, recordedUntil: 200, observedOn: "2026-09-10", limit: 100 }

describe("発効済みの入社・再入社・退職の発令の取得", () => {
  test("種別、記録時刻、発効日で絞り、退職は最終在籍日の翌日から返す", async () => {
    const actions = await listDueEmploymentLifecycleActions({
      database: await createDatabase(),
      ...window,
      afterSequence: 0,
    })
    if (actions instanceof Error) throw actions

    expect(actions.map((action) => action.actionId)).toEqual([
      "hire-due",
      "retired-day-before",
      "corrected-retired-due",
      "corrected-void",
    ])
    expect(actions[0]?.payloadFingerprint).toBe("fingerprint:hire-due")
  })

  test("sequenceで続きから取得し、欠落と重複を作らない", async () => {
    const database = await createDatabase()
    const first = await listDueEmploymentLifecycleActions({
      database,
      ...window,
      limit: 2,
      afterSequence: 0,
    })
    if (first instanceof Error) throw first
    const second = await listDueEmploymentLifecycleActions({
      database,
      ...window,
      limit: 2,
      afterSequence: first.at(-1)?.sequence ?? 0,
    })
    if (second instanceof Error) throw second

    expect([...first, ...second].map((action) => action.actionId)).toEqual([
      "hire-due",
      "retired-day-before",
      "corrected-retired-due",
      "corrected-void",
    ])
  })

  test("不正な範囲、件数、日付を拒否する", async () => {
    const database = await createDatabase()
    for (const invalid of [
      { recordedUntil: 10 },
      { limit: 0 },
      { limit: 101 },
      { afterSequence: -1 },
      { observedOn: "2026/09/10" },
    ])
      expect(
        await listDueEmploymentLifecycleActions({
          database,
          ...window,
          afterSequence: 0,
          ...invalid,
        }),
      ).toBeInstanceOf(Error)
  })
})
