/**
 * 直前のステートメントが 0 行変更だったとき、json_extract('', '$') で D1 batch を
 * アボートさせるガード文を返す。
 *
 * Cloudflare D1 の batch() は BEGIN TRANSACTION を使わず、ステートメントを順次実行する。
 * 前のステートメントが 0 行変更（= 条件不一致）の場合に json_extract('', '$') で
 * 意図的にエラーを発生させてバッチ全体を rollback する。
 */
export function abortWhenPreviousStatementChangedNoRows(db: D1Database): D1PreparedStatement {
  return db.prepare("SELECT CASE WHEN changes() = 0 THEN json_extract('', '$') ELSE 1 END AS ok")
}
