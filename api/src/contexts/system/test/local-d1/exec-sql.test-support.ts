import { splitSqlStatements } from "@system/test/local-d1/split-sql-statements.test-support"

/**
 * 複数行・複数文のSQLをローカルD1で1つのbatchとして実行する。
 * D1の`exec`は改行ごとに1文として扱うため、triggerや複数行のINSERTを渡せない。
 * test前提の投入や、失敗を注入するtriggerの作成に使う。
 */
export async function execSql(database: D1Database, sql: string): Promise<void> {
  const statements = splitSqlStatements(sql)
  if (statements.length === 0) return
  await database.batch(statements.map((statement) => database.prepare(statement)))
}
