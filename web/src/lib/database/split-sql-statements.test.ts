import { Database } from "bun:sqlite"
import { describe, expect, test } from "bun:test"
import { splitSqlStatements } from "@/lib/database/split-sql-statements"

describe("SQL migrationの文境界", () => {
  test("文字列・識別子・コメント内のセミコロンで分割しない", () => {
    const database = new Database(":memory:")
    try {
      const statements = splitSqlStatements(`
        -- schema; comment
        CREATE TABLE "sample;rows" ([text;value] TEXT);
        /* value; comment */
        INSERT INTO "sample;rows" VALUES ('it''s; preserved');
        -- trailing comment;
      `)
      expect(statements).toHaveLength(2)
      for (const statement of statements) database.run(statement)
      expect(database.query('SELECT * FROM "sample;rows"').all()).toEqual([
        { "text;value": "it's; preserved" },
      ])
      expect(splitSqlStatements("-- comment;\n/* comment; */")).toEqual([])
    } finally {
      database.close()
    }
  })

  test("triggerの複数文を一つのDDLとして実行する", () => {
    const database = new Database(":memory:")
    try {
      const statements = splitSqlStatements(`
        CREATE TABLE events (value TEXT);
        CREATE TABLE effects (value TEXT);
        CREATE TRIGGER copy_events AFTER INSERT ON events BEGIN
          INSERT INTO effects VALUES (NEW.value);
          INSERT INTO effects VALUES ('second;effect');
        END;
        INSERT INTO events VALUES ('first');
      `)
      expect(statements).toHaveLength(4)
      for (const statement of statements) database.run(statement)
      expect(database.query("SELECT value FROM effects ORDER BY rowid").all()).toEqual([
        { value: "first" },
        { value: "second;effect" },
      ])
    } finally {
      database.close()
    }
  })

  test("途中の制約違反を後続文で隠さず、transactionを取り消せる", () => {
    const database = new Database(":memory:")
    try {
      database.run("CREATE TABLE items (value INTEGER CHECK (value > 0))")
      const migrate = database.transaction(() => {
        for (const statement of splitSqlStatements(`
          INSERT INTO items VALUES (1);
          INSERT INTO items VALUES (0);
          INSERT INTO items VALUES (2);
        `))
          database.run(statement)
      })
      expect(() => migrate()).toThrow()
      expect(database.query("SELECT * FROM items").all()).toEqual([])
    } finally {
      database.close()
    }
  })
})
