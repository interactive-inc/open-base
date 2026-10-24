import { describe, expect, test } from "bun:test"
import { abortWhenPreviousStatementChangedNoRows } from "@/lib/database/abort-when-previous-statement-changed-no-rows"

describe("abortWhenPreviousStatementChangedNoRows", () => {
  test("直前の変更件数が0ならD1 batchを失敗させるguard statementを返す", () => {
    const statement = {} as D1PreparedStatement
    let preparedSql: string | undefined
    const database = {
      prepare(sql: string): D1PreparedStatement {
        preparedSql = sql
        return statement
      },
    } as D1Database

    expect(abortWhenPreviousStatementChangedNoRows(database)).toBe(statement)
    expect(preparedSql).toBe(
      "SELECT CASE WHEN changes() = 0 THEN json_extract('', '$') ELSE 1 END AS ok",
    )
  })
})
