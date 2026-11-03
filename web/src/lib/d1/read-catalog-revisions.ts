import type { CatalogQuery, CatalogStorageContext } from "@/lib/d1/catalog-storage"

export async function readCatalogRevisions<Record extends { expected_revision: number }>(
  context: CatalogStorageContext,
  source: { table: string; predicate: string },
  query: CatalogQuery,
) {
  const { table, predicate } = source
  const statement = context.db
    .prepare(`
    SELECT record_id, revision, snapshot_json, actor_account_id, recorded_at, request_id
    FROM ${table} current
    WHERE (?1 IS NULL OR record_id = ?1)
      AND (?2 IS NULL OR instr(lower(json_extract(snapshot_json, '$.name')), lower(?2)) > 0 OR (${predicate}))
      AND (?3 = 1 OR revision = (SELECT max(latest.revision) FROM ${table} latest WHERE latest.record_id = current.record_id))
    ORDER BY record_id, revision DESC LIMIT ?4 OFFSET ?5
  `)
    .bind(query.id ?? null, query.search ?? null, Number(query.history), query.limit, query.offset)
  const [result] = await context.db.batch<{
    revision: number
    snapshot_json: string
    actor_account_id: string
    recorded_at: string
    request_id: string
  }>([statement, ...context.guards])
  return result!.results.map(({ snapshot_json, ...metadata }) => {
    const { expected_revision: _, ...record } = JSON.parse(snapshot_json) as Record
    return { ...record, ...metadata }
  })
}
