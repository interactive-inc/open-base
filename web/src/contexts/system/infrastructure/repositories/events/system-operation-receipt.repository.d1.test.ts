import { execSql } from "@system/test/local-d1/exec-sql.test-support"
import { expect, setDefaultTimeout, test } from "bun:test"
import { Database } from "bun:sqlite"
import { readFileSync } from "node:fs"
import { SystemOperationReceiptEntity } from "@system/domain/entities/system-operation-receipt.entity"
import { SystemOperationReceiptRepository } from "./system-operation-receipt.repository"
import { createLocalD1Database } from "@system/test/local-d1/create-local-d1-database.test-support"
import { systemOperationReceipts } from "@system/infrastructure/schema/system-operation-receipt"
import { getTableConfig } from "drizzle-orm/sqlite-core"
import { readReleasedSystemMigration } from "@system/test/read-released-system-migration.test-support"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

const ddl = readFileSync(
  new URL("../../schema/system-operation-receipt.sql", import.meta.url),
  "utf8",
)
const input = {
  operationKey: "record.create",
  scopeKey: "scope:1",
  commandId: "command:1",
  actorAccountId: "c0975461-26d2-43a1-86d2-124bd000d9c9",
  actorPrincipalId: "principal:1",
  requestDigest: "a".repeat(64),
  recordedAt: 1000,
  result: { created: 1, ids: ["record:1"] },
}
async function fixture() {
  const database = await createLocalD1Database({
    schema: `${ddl}\nCREATE TABLE test_business_records (id TEXT PRIMARY KEY);`,
  })
  const repository = new SystemOperationReceiptRepository({ env: { DB: database } })
  const entity = await SystemOperationReceiptEntity.create(input)
  if (entity instanceof Error) throw entity
  return { database, repository, entity }
}
async function failure(operation: Promise<unknown>) {
  return operation.then(
    () => null,
    (cause: unknown) => cause,
  )
}

test("準備だけでは保存せず、業務変更と結果を一緒に確定する", async () => {
  const { database, repository, entity } = await fixture()
  const statement = repository.prepare(entity)
  expect(await repository.find(input)).toBeNull()
  await database.batch([
    database.prepare("INSERT INTO test_business_records VALUES ('record:1')"),
    statement,
  ])
  const read = await repository.find(input)
  expect(read).toBeInstanceOf(SystemOperationReceiptEntity)
  if (!(read instanceof SystemOperationReceiptEntity)) throw read
  expect(read.props).toEqual(entity.props)
  expect(Object.isFrozen(read.props)).toBe(true)
  expect(
    await database
      .prepare("SELECT count(*) AS count FROM test_business_records")
      .first<Record<string, unknown>>(),
  ).toEqual({
    count: 1,
  })
  expect(
    await failure(
      database.batch([
        database.prepare("INSERT INTO test_business_records VALUES ('record:2')"),
        repository.prepare(entity),
      ]),
    ),
  ).toBeInstanceOf(Error)
  expect(
    await database
      .prepare("SELECT count(*) AS count FROM test_business_records")
      .first<Record<string, unknown>>(),
  ).toEqual({
    count: 1,
  })
  await expect(
    execSql(database, "UPDATE system_operation_receipts SET actor_account_id = 'other'"),
  ).rejects.toThrow()
  await expect(execSql(database, "DELETE FROM system_operation_receipts")).rejects.toThrow()
})

test("結果読取にも同じtransactionの認可条件を適用する", async () => {
  const { database, repository, entity } = await fixture()
  await database.batch([repository.prepare(entity)])
  const result = await repository.find(input, [
    database.prepare("SELECT json_extract('{}', 'denied')"),
  ])
  expect(result).toBeInstanceOf(Error)
})

test("対象範囲ごとにキーを分け、結果の不正なdigestを成功として返さない", async () => {
  const { database, repository, entity } = await fixture()
  const other = await SystemOperationReceiptEntity.create({ ...input, scopeKey: "scope:2" })
  if (other instanceof Error) throw other
  await database.batch([repository.prepare(entity), repository.prepare(other)])
  expect(await repository.find({ ...input, scopeKey: "scope:missing" })).toBeNull()
  await execSql(database, "DROP TRIGGER system_operation_receipts_no_update")
  await execSql(
    database,
    "UPDATE system_operation_receipts SET result_json = '{\"created\":999}' WHERE scope_key = 'scope:1'",
  )
  expect(await repository.find(input)).toBeInstanceOf(Error)
  expect(await repository.find({ ...input, scopeKey: "scope:2" })).toBeInstanceOf(
    SystemOperationReceiptEntity,
  )
})

test("入力の識別子・digest・結果JSONと容量を検証する", async () => {
  for (const override of [
    { commandId: "command\n" },
    { requestDigest: "invalid" },
    { requestDigest: "a".repeat(64) + "\n" },
    { actorPrincipalId: "" },
    { recordedAt: -1 },
    { result: undefined },
    { result: "x".repeat(1_000_001) },
  ])
    expect(await SystemOperationReceiptEntity.create({ ...input, ...override })).toBeInstanceOf(
      Error,
    )
  const first = await SystemOperationReceiptEntity.create({ ...input, result: { b: 2, a: 1 } })
  const second = await SystemOperationReceiptEntity.create({ ...input, result: { a: 1, b: 2 } })
  if (first instanceof Error || second instanceof Error)
    throw new Error("canonical result is invalid")
  expect(first.props.resultJson).toBe(second.props.resultJson)
  expect(first.props.resultDigest).toBe(second.props.resultDigest)
})

test("DDLとDrizzleの列を一致させ、DBでも壊れたJSONを拒否する", async () => {
  const { database, repository, entity } = await fixture()
  const columns = (
    await database.prepare("PRAGMA table_info(system_operation_receipts)").all<{ name: string }>()
  ).results
    .map((row) => row.name)
    .sort()
  expect(columns).toEqual(
    getTableConfig(systemOperationReceipts)
      .columns.map((column) => column.name)
      .sort(),
  )
  await database.batch([repository.prepare(entity)])
  await execSql(database, "DROP TRIGGER system_operation_receipts_no_update")
  await expect(
    execSql(database, "UPDATE system_operation_receipts SET result_json = 'not json'"),
  ).rejects.toThrow()
  await expect(
    execSql(database, "UPDATE system_operation_receipts SET result_digest = 'invalid'"),
  ).rejects.toThrow()
  await expect(
    execSql(database, "UPDATE system_operation_receipts SET recorded_at = 1.5"),
  ).rejects.toThrow()
})

// 作成時のmigrationは複合主キーで、UUIDの主キーへの作り直しは後続のmigrationが行う。
// 作成時点では主キー以外の列、索引、変更禁止triggerが正本と一致することを確かめる。
test("各製品の追記migrationが同じ列・索引・変更禁止triggerを作る", () => {
  const canonical = new Database(":memory:")
  const released = new Database(":memory:")
  canonical.exec(ddl)
  for (const name of [
    "create_system_operation_receipts",
    "guard_system_operation_receipt_update",
    "guard_system_operation_receipt_delete",
  ])
    released.exec(readReleasedSystemMigration(name))
  const structure = (database: Database) =>
    database
      .query(
        "SELECT type, name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' AND type != 'table' ORDER BY type, name",
      )
      .all()
  const columns = (database: Database) =>
    database
      .query<{ name: string; type: string; notnull: number }, []>(
        "SELECT name, type, \"notnull\" FROM pragma_table_info('system_operation_receipts') WHERE name != 'id' ORDER BY cid",
      )
      .all()
  expect(structure(released)).toEqual(structure(canonical))
  expect(columns(released)).toEqual(columns(canonical))
  canonical.close()
  released.close()
})
