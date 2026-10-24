/** 直前の更新が0件ならD1 batch全体をrollbackさせるguard statementを返す。 */
function abortWhenPreviousStatementChangedNoRows(db: D1Database): D1PreparedStatement {
  return db.prepare("SELECT CASE WHEN changes() = 0 THEN json_extract('', '$') ELSE 1 END AS ok")
}
type AbortWhenPreviousStatementChangedNoRowsAdapterContext = D1Database
type Context = AbortWhenPreviousStatementChangedNoRowsAdapterContext

export class AbortWhenPreviousStatementChangedNoRowsAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  abortWhenPreviousStatementChangedNoRows(): D1PreparedStatement {
    return abortWhenPreviousStatementChangedNoRows(this.c)
  }
}
