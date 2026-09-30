import type { SystemD1Context } from "@system/configuration/system-context"
import type { ExternalAssertionEntity } from "@system/domain/entities/external-assertion.entity"
import type { ReconciliationRunEntity } from "@system/domain/entities/reconciliation-run.entity"

export type SystemReconciliationWriteResult =
  | Readonly<{ kind: "written"; run: ReconciliationRunEntity }>
  | Readonly<{ kind: "conflict" }>
  | Readonly<{ kind: "unavailable"; cause: unknown }>

type Context = SystemD1Context

/** assertionとsemantic item差分を同一D1 batchへappendする。 */
export class SystemReconciliationRepository {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async findMany(
    exchangeId: string,
  ): Promise<ReadonlyArray<Readonly<Record<string, unknown>>> | Error> {
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
        .all<Record<string, unknown>>()
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
    try {
      const exchange = await database
        .prepare("SELECT connector_id FROM system_integration_exchanges WHERE id = ?1 LIMIT 1")
        .bind(run.exchangeId)
        .first<{ connector_id: string }>()
      if (exchange === null || exchange.connector_id !== assertion.connectorId) {
        return { kind: "conflict" }
      }
      await database.batch([
        assertionInsert(database, assertion),
        runInsert(database, run),
        ...run.items.map((item) => itemInsert(database, run.id, item)),
        ...auditStatements,
      ])
      return { kind: "written", run }
    } catch (cause) {
      return isConstraintConflict(cause) ? { kind: "conflict" } : { kind: "unavailable", cause }
    }
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
