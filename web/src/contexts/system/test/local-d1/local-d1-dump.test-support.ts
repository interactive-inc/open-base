import { z } from "zod"

const schemaObjectSchema = z.strictObject({
  type: z.enum(["table", "index", "trigger", "view"]),
  name: z.string(),
  sql: z.string(),
})

/** blobはbase64にし、JSONへ書いても値の型を失わないようにする。 */
const cellSchema = z.union([
  z.string(),
  z.number(),
  z.null(),
  z.strictObject({ bytes: z.string() }),
])

export const localD1DumpSchema = z.strictObject({
  version: z.literal(1),
  schema: z.array(schemaObjectSchema),
  rows: z.record(z.string(), z.array(z.record(z.string(), cellSchema))),
})

export type LocalD1Dump = z.infer<typeof localD1DumpSchema>

function toCell(value: unknown): z.infer<typeof cellSchema> {
  if (value === null || typeof value === "string" || typeof value === "number") return value
  if (typeof value === "bigint") return Number(value)
  if (typeof value === "boolean") return value ? 1 : 0
  const bytes =
    value instanceof ArrayBuffer
      ? new Uint8Array(value)
      : Array.isArray(value)
        ? Uint8Array.from(value as number[])
        : value instanceof Uint8Array
          ? value
          : null
  if (bytes === null) throw new Error(`unsupported D1 value: ${typeof value}`)
  return { bytes: Buffer.from(bytes).toString("base64") }
}

function fromCell(value: z.infer<typeof cellSchema>): unknown {
  return typeof value === "object" && value !== null
    ? Uint8Array.from(Buffer.from(value.bytes, "base64"))
    : value
}

/** SQLiteとCloudflareの内部objectを除いた、利用者が作ったschemaだけを対象にする。 */
function isUserObject(name: string): boolean {
  return !name.startsWith("sqlite_") && !name.startsWith("_cf_") && !name.startsWith("d1_")
}

/**
 * ローカルD1の全schemaと全行を、別のプロセスで同じDBを作り直せる形で書き出す。
 * 業務の撤去確定後の状態を、業務を物理除去した構成へ渡すために使う。
 */
export async function exportLocalD1(database: D1Database): Promise<LocalD1Dump> {
  const objects = await database
    .prepare(
      "SELECT type, name, sql FROM sqlite_master WHERE sql IS NOT NULL AND type IN ('table','index','trigger','view') ORDER BY rowid",
    )
    .all<{ type: "table" | "index" | "trigger" | "view"; name: string; sql: string }>()
  const schema = objects.results.filter((object) => isUserObject(object.name))
  const rows: LocalD1Dump["rows"] = {}
  for (const object of schema) {
    if (object.type !== "table") continue
    // 生成列はSQLiteが計算するため書き出さない。読込みで値を入れると失敗する。
    const columns = await database
      .prepare("SELECT name, hidden FROM pragma_table_xinfo(?1)")
      .bind(object.name)
      .all<{ name: string; hidden: number }>()
    const stored = columns.results
      .filter((column) => column.hidden !== 2 && column.hidden !== 3)
      .map((column) => `"${column.name.replaceAll('"', '""')}"`)
    if (stored.length === 0) continue
    const read = await database
      .prepare(`SELECT ${stored.join(",")} FROM "${object.name}"`)
      .all<Record<string, unknown>>()
    rows[object.name] = read.results.map((row) =>
      Object.fromEntries(Object.entries(row).map(([column, value]) => [column, toCell(value)])),
    )
  }
  return { version: 1, schema, rows }
}

/**
 * 空のローカルD1へ書き出したschemaと行を読み込む。
 * 表を作ってから外部キーの検査を遅らせて全行を入れ、最後に索引とtriggerを作る。
 * 追記専用のtriggerや停止のtriggerを読込み中に発火させない。
 */
export async function importLocalD1(database: D1Database, dump: LocalD1Dump): Promise<void> {
  const parsed = localD1DumpSchema.parse(dump)
  for (const object of parsed.schema.filter((entry) => entry.type === "table"))
    await database.prepare(object.sql).run()
  const inserts: D1PreparedStatement[] = [database.prepare("PRAGMA defer_foreign_keys = ON")]
  for (const [table, rows] of Object.entries(parsed.rows))
    for (const row of rows) {
      const columns = Object.keys(row)
      if (columns.length === 0) continue
      inserts.push(
        database
          .prepare(
            `INSERT INTO "${table}" (${columns.map((column) => `"${column}"`).join(",")}) VALUES (${columns.map((_, index) => `?${index + 1}`).join(",")})`,
          )
          .bind(...columns.map((column) => fromCell(row[column] ?? null))),
      )
    }
  if (inserts.length > 1) await database.batch(inserts)
  for (const type of ["index", "view", "trigger"] as const)
    for (const object of parsed.schema.filter((entry) => entry.type === type))
      await database.prepare(object.sql).run()
}
