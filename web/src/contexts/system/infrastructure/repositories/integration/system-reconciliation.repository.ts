import type { SystemD1Context } from "@system/configuration/system-context"
import type { ExternalAssertionEntity } from "@system/domain/entities/external-assertion.entity"
import type { ReconciliationRunEntity } from "@system/domain/entities/reconciliation-run.entity"

export type SystemReconciliationWriteResult =
  | Readonly<{ kind: "written"; run: ReconciliationRunEntity }>
  | Readonly<{ kind: "conflict" }>
  | Readonly<{ kind: "unavailable"; cause: unknown }>

type Context = SystemD1Context

type ReconciliationRunRow = Readonly<{
  id: string
  exchange_id: string
  assertion_id: string
  local_version: string
  status: ReconciliationRunEntity["status"]
  item_count: number
  created_at: number
}>

type StoredAssertionRow = Readonly<{
  id: string
  connector_id: string
  exchange_id: string | null
  external_key: string
  external_version: string
  payload_digest: string
  observed_at: number
}>

/** 保存済みassertionとの関係。absentは未保存、sameは同じ外部の事実、differentは別の事実との衝突。 */
type StoredAssertionRelation = "absent" | "same" | "different"

/**
 * assertionとsemantic item差分を同一D1 batchへappendする。
 * 同じ外部の事実を表すassertionが保存済みなら作り直さず、runだけを追加する。
 */
export class SystemReconciliationRepository {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async findMany(exchangeId: string): Promise<ReadonlyArray<ReconciliationRunRow> | Error> {
    try {
      const rows = await this.c.env.DB.prepare(
        `SELECT run.id, run.exchange_id, run.assertion_id, run.local_version,
                run.status, run.created_at, count(item.item_key) AS item_count
         FROM system_reconciliation_runs AS run
         INNER JOIN system_reconciliation_items AS item ON item.run_id = run.id
         WHERE run.exchange_id = ?1
         GROUP BY run.id ORDER BY run.created_at DESC, run.id DESC`,
      )
        .bind(exchangeId)
        .all<ReconciliationRunRow>()
      return Object.freeze(rows.results.map((row) => Object.freeze({ ...row })))
    } catch (cause) {
      return cause instanceof Error ? cause : new Error("failed to find reconciliation runs")
    }
  }

  async write(
    assertion: ExternalAssertionEntity,
    run: ReconciliationRunEntity,
    auditStatements: ReadonlyArray<D1PreparedStatement> = [],
  ): Promise<SystemReconciliationWriteResult> {
    if (run.exchangeId !== assertion.exchangeId || run.assertionId !== assertion.id) {
      return { kind: "conflict" }
    }
    const database = this.c.env.DB
    const runStatements = [
      runInsert(database, run),
      ...run.items.map((item) => itemInsert(database, run.id, item)),
      ...auditStatements,
    ]
    try {
      const exchange = await database
        .prepare("SELECT connector_id FROM system_integration_exchanges WHERE id = ?1 LIMIT 1")
        .bind(run.exchangeId)
        .first<{ connector_id: string }>()
      if (exchange === null || exchange.connector_id !== assertion.connectorId) {
        return { kind: "conflict" }
      }
      const stored = await findStoredAssertionRelation(database, assertion)
      if (stored === "different") return { kind: "conflict" }
      if (stored === "same") return await appendBatch(database, run, runStatements)
      const created = await appendBatch(database, run, [
        assertionInsert(database, assertion),
        ...runStatements,
      ])
      if (created.kind !== "conflict") return created
      // 並行する照合が同じassertionを先に作った場合だけ、保存済みの事実との一致を確かめてrunを追加する。
      if ((await findStoredAssertionRelation(database, assertion)) !== "same") return created
      return await appendBatch(database, run, runStatements)
    } catch (cause) {
      return { kind: "unavailable", cause }
    }
  }
}

/** assertionは変更も削除もできないため、一致を一度確かめれば後続のbatchまで結果は変わらない。 */
async function findStoredAssertionRelation(
  database: D1Database,
  assertion: ExternalAssertionEntity,
): Promise<StoredAssertionRelation> {
  const rows = await database
    .prepare(
      `SELECT id, connector_id, exchange_id, external_key, external_version, payload_digest,
              observed_at
       FROM system_external_assertions
       WHERE id = ?1 OR (connector_id = ?2 AND external_key = ?3 AND external_version = ?4)`,
    )
    .bind(assertion.id, assertion.connectorId, assertion.externalKey, assertion.externalVersion)
    .all<StoredAssertionRow>()
  if (rows.results.length === 0) return "absent"
  return rows.results.every((row) => isSameAssertion(row, assertion)) ? "same" : "different"
}

/**
 * 別のidや別の交換から同じ外部の版を渡す要求は、保存済みのassertionを指していないため一致としない。
 * 受信時刻は照合のたびに変わるため、照合する項目に含めない。
 */
function isSameAssertion(row: StoredAssertionRow, assertion: ExternalAssertionEntity): boolean {
  return (
    row.id === assertion.id &&
    row.connector_id === assertion.connectorId &&
    row.exchange_id === assertion.exchangeId &&
    row.external_key === assertion.externalKey &&
    row.external_version === assertion.externalVersion &&
    row.payload_digest === assertion.payloadDigest &&
    row.observed_at === assertion.observedAt.getTime()
  )
}

/** 1つのbatchで不可分に保存し、制約違反だけを競合として返す。 */
async function appendBatch(
  database: D1Database,
  run: ReconciliationRunEntity,
  statements: ReadonlyArray<D1PreparedStatement>,
): Promise<SystemReconciliationWriteResult> {
  try {
    await database.batch([...statements])
    return { kind: "written", run }
  } catch (cause) {
    return isConstraintConflict(cause) ? { kind: "conflict" } : { kind: "unavailable", cause }
  }
}

function assertionInsert(database: D1Database, assertion: ExternalAssertionEntity) {
  return database
    .prepare(
      `INSERT INTO system_external_assertions
         (id, connector_id, exchange_id, external_key, external_version, payload_digest,
          observed_at, received_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
    )
    .bind(
      assertion.id,
      assertion.connectorId,
      assertion.exchangeId,
      assertion.externalKey,
      assertion.externalVersion,
      assertion.payloadDigest,
      assertion.observedAt.getTime(),
      assertion.receivedAt.getTime(),
    )
}

function runInsert(database: D1Database, run: ReconciliationRunEntity) {
  return database
    .prepare(
      `INSERT INTO system_reconciliation_runs
         (id, exchange_id, assertion_id, local_version, status, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
    )
    .bind(
      run.id,
      run.exchangeId,
      run.assertionId,
      run.localVersion,
      run.status,
      run.createdAt.getTime(),
    )
}

function itemInsert(
  database: D1Database,
  runId: string,
  item: ReconciliationRunEntity["items"][number],
) {
  return database
    .prepare(
      `INSERT INTO system_reconciliation_items
         (id, run_id, item_key, local_digest, external_digest, status)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
    )
    .bind(crypto.randomUUID(), runId, item.key, item.localDigest, item.externalDigest, item.status)
}

function isConstraintConflict(cause: unknown): boolean {
  return cause instanceof Error && /constraint|unique/i.test(cause.message)
}
