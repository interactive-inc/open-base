import { countLocalD1Queries } from "@system/test/local-d1/count-local-d1-queries.test-support"
import { execSql } from "@system/test/local-d1/exec-sql.test-support"
import { startLocalD1 } from "@system/test/local-d1/start-local-d1.test-support"

type Options = Readonly<{
  /** 空のDBへ適用するschema。省略すると全migrationを適用したDBを返す。 */
  schema?: string
  /** 文の実行ごと、batchの文ごと、execごとに呼ぶ。 */
  onQuery?: () => void
}>

/**
 * これ以上の大きさのschemaは、一度だけ適用したtemplateを複製する。
 * templateはmachineの一時ディレクトリへ保存し、testファイルごとに実行環境を作り直すrunnerでも
 * 後続のファイルとプロセスで使い回す。小さいschemaは複製の準備より直接の適用が速い。
 */
const SCHEMA_TEMPLATE_MIN_LENGTH = 32 * 1024

let sequence = 0

/**
 * Cloudflare提供のローカルD1に、testごとに独立したDBを1つ用意する。
 * schemaを渡すとそのschemaだけのDBを、省略すると全migrationを適用したtemplateの複製を返す。
 * DBは共有workerdの未使用の枠を使い、他のtestと共有しない。
 */
export async function createLocalD1Database(options: Options = {}): Promise<D1Database> {
  sequence += 1
  const name = `local-d1-database-${sequence}`
  const schema = options.schema
  const templated = schema === undefined || schema.length >= SCHEMA_TEMPLATE_MIN_LENGTH
  const local = await startLocalD1(templated ? { migrated: [name], schema } : { empty: [name] })
  const database = await local.database(name)
  if (!templated && schema !== undefined) await execSql(database, schema)
  return options.onQuery === undefined
    ? database
    : countLocalD1Queries(database, options.onQuery).database
}
