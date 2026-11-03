import type { CatalogStorageContext } from "@/lib/d1/catalog-storage"

export async function saveCatalogRevision(
  context: CatalogStorageContext,
  destination: { table: string; target: string },
  input: { command: { id: string; expected_revision: number }; key: string },
) {
  const { db, guards, accountId, requestId, now } = context
  const { command, key } = input
  const snapshot = JSON.stringify(command)
  const revision = command.expected_revision + 1
  const audit = context.audit(destination.target, command.id, revision)
  const insert = db
    .prepare(`
    INSERT INTO ${destination.table} (record_id, revision, actor_account_id, request_id, idempotency_key, recorded_at, snapshot_json)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)
    .bind(command.id, revision, accountId, requestId, key, now.toISOString(), snapshot)
  try {
    await db.batch([...guards, insert, ...audit])
    return { id: command.id, revision }
  } catch (error) {
    const replay = db
      .prepare(`
      SELECT record_id AS id, revision, snapshot_json FROM ${destination.table}
      WHERE actor_account_id = ? AND idempotency_key = ?
    `)
      .bind(accountId, key)
    const [result] = await db.batch<{ id: string; revision: number; snapshot_json: string }>([
      replay,
      ...guards,
    ])
    const prior = result?.results[0]
    if (prior)
      return prior.snapshot_json === snapshot
        ? { id: prior.id, revision: prior.revision }
        : "idempotency_key_reused"
    if (error instanceof Error && /constraint|catalog_revision_conflict/i.test(error.message))
      return "catalog_write_conflict"
    throw error
  }
}
