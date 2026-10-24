import { execSql } from "@system/test/local-d1/exec-sql.test-support"
import { describe, expect, setDefaultTimeout, test } from "bun:test"
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { createLocalD1Database } from "@system/test/local-d1/create-local-d1-database.test-support"
import { COMPANY_TEST_MIGRATIONS_DIR } from "@/contexts/company/test/migrations-directory.test-support"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

describe("雇用改訂を人事履歴へ追加する移行", () => {
  test("既存の全列とrowidを保全し、移行後も更新・削除・重複訂正を拒否する", async () => {
    const files = readdirSync(COMPANY_TEST_MIGRATIONS_DIR)
      .filter((file) => file.endsWith(".sql"))
      .sort()
    const migration = files.find((file) =>
      file.endsWith("_record_employment_resource_revisions.sql"),
    )
    if (migration === undefined) throw new Error("missing employment revision migration")
    const database = await createLocalD1Database({
      schema: files
        .filter((file) => file < migration)
        .map((file) => readFileSync(join(COMPANY_TEST_MIGRATIONS_DIR, file), "utf8"))
        .join("\n"),
    })
    const summary = JSON.stringify({
      kind: "initial_state",
      eventOn: "2026-01-01",
      department: null,
      positionTitle: null,
      managerEmployeeCode: null,
      status: "active",
    })
    await database
      .prepare(`INSERT INTO company_personnel_actions
      (rowid, id, employee_id, kind, event_on, recorded_at, recorded_by_account_id,
       requested_by_employee_id, source_type, source_application_id, corrects_action_id,
       operation_id, payload_fingerprint, summary_json)
      VALUES (17, 'action:existing', 'employee:existing', 'initial_state', '2026-01-01', 1,
        'account:operator', NULL, 'system', NULL, NULL, 'operation:existing', ?1, ?2)`)
      .bind("a".repeat(64), summary)
      .run()
    const before = (
      await database.prepare("SELECT rowid, * FROM company_personnel_actions ORDER BY rowid").all()
    ).results
    const applied = [
      migration,
      files.find((file) => file.endsWith("_guard_company_personnel_action_delete.sql")),
      files.find((file) => file.endsWith("_guard_company_personnel_action_update.sql")),
    ]
    for (const file of applied) {
      if (file === undefined) throw new Error("missing personnel action guard migration")
      await execSql(database, readFileSync(join(COMPANY_TEST_MIGRATIONS_DIR, file), "utf8"))
    }
    expect(
      (
        await database
          .prepare("SELECT rowid, * FROM company_personnel_actions ORDER BY rowid")
          .all()
      ).results,
    ).toEqual(before)
    for (const query of [
      "UPDATE company_personnel_actions SET summary_json = '{}'",
      "DELETE FROM company_personnel_actions",
    ]) {
      const failure = await database
        .prepare(query)
        .run()
        .catch((cause: unknown) => cause)
      expect(failure).toBeInstanceOf(Error)
      if (!(failure instanceof Error)) throw new Error("missing append-only guard")
      expect(failure.message).toContain("append only")
    }
    const insert = (id: string) =>
      database
        .prepare(`INSERT INTO company_personnel_actions
      (id, employee_id, kind, event_on, recorded_at, source_type, operation_id, payload_fingerprint,
       summary_json, corrects_action_id)
      VALUES (?1, 'employee:existing', 'employment_revised', '2026-01-01', 2, 'system', ?1, ?2, '{}', 'action:existing')`)
        .bind(id, "b".repeat(64))
        .run()
    await insert("action:first")
    expect(await insert("action:duplicate").catch((cause: unknown) => cause)).toBeInstanceOf(Error)
    expect((await database.prepare("PRAGMA foreign_key_check").all()).results).toEqual([])
  })
})
