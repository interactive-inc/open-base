import { expect, setDefaultTimeout, test } from "bun:test"
import { splitSqlStatements } from "@system/test/local-d1/split-sql-statements.test-support"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

test("trigger本体のセミコロンで分けず、前置きのcommentと空行を読み飛ばす", () => {
  const sql = `CREATE TABLE logs (id TEXT);--> statement-breakpoint

/* 説明 */
CREATE TRIGGER logs_prevent_delete
BEFORE DELETE ON logs
BEGIN
  SELECT RAISE(ABORT, 'append-only');
END;
-- 後続
INSERT INTO logs VALUES ('a;b');`

  expect(splitSqlStatements(sql)).toEqual([
    "CREATE TABLE logs (id TEXT);",
    `--> statement-breakpoint

/* 説明 */
CREATE TRIGGER logs_prevent_delete
BEFORE DELETE ON logs
BEGIN
  SELECT RAISE(ABORT, 'append-only');
END;`,
    "-- 後続\nINSERT INTO logs VALUES ('a;b');",
  ])
})
