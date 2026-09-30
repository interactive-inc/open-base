import type { Column, SQL } from "drizzle-orm"
import { sql } from "drizzle-orm"

/**
 * LIKE のワイルドカード文字（% _）とエスケープ文字（\）をエスケープする。
 * これをしないとユーザー入力の % で全件ヒット、_ で任意1文字マッチが発生する。
 */
function escapeLikeKeyword(keyword: string): string {
  return keyword.replace(/[\\%_]/g, "\\$&")
}

/**
 * column LIKE '%<escaped keyword>%' ESCAPE '\' を組み立てる。
 * SQLite/D1 は LIKE のデフォルトエスケープ文字を持たないため ESCAPE '\' を明示する。
 */
export function likeKeyword(column: Column | SQL, keyword: string): SQL {
  const pattern = `%${escapeLikeKeyword(keyword)}%`

  return sql`${column} LIKE ${pattern} ESCAPE '\\'`
}
