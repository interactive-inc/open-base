import type { Database } from "bun:sqlite"
import { splitSqlStatements } from "../src/lib/database/split-sql-statements"

export function executeSql(database: Database, sql: string, source: string): void {
  for (const statement of splitSqlStatements(sql)) {
    try {
      database.run(statement)
    } catch (cause) {
      throw new Error(`${source} failed near: ${statement.slice(0, 160)}`, { cause })
    }
  }
}
