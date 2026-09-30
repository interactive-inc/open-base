import type { SystemD1Context } from "@system/configuration/system-context"
import { IntegrationExchangeEntity } from "@system/domain/entities/integration-exchange.entity"

export type SystemIntegrationExchangeWriteResult =
  | Readonly<{ kind: "written"; exchange: IntegrationExchangeEntity; replayed: boolean }>
  | Readonly<{ kind: "conflict" }>
  | Readonly<{ kind: "unavailable"; cause: unknown }>

type ExchangeRow = Readonly<Record<string, unknown>>
type Context = SystemD1Context

/** 外部交換のidempotencyと楽観競合をD1で直列化する。 */
export class SystemIntegrationExchangeRepository {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async find(id: string): Promise<IntegrationExchangeEntity | null | Error> {
    try {
      const row = await this.c.env.DB.prepare(
        `SELECT id, connector_id, direction, operation_key, idempotency_key, payload_digest,
                status, attempt, external_reference, last_error_code,
                created_at, updated_at, completed_at
         FROM system_integration_exchanges WHERE id = ?1 LIMIT 1`,
      )
        .bind(id)
        .first<ExchangeRow>()
      return row === null ? null : toExchange(row)
    } catch (cause) {
      return cause instanceof Error ? cause : new Error("failed to find integration exchange")
    }
  }

  async findMany(connectorId: string): Promise<ReadonlyArray<IntegrationExchangeEntity> | Error> {
    try {
      const rows = await this.c.env.DB.prepare(
        `SELECT id, connector_id, direction, operation_key, idempotency_key, payload_digest,
                status, attempt, external_reference, last_error_code,
                created_at, updated_at, completed_at
         FROM system_integration_exchanges WHERE connector_id = ?1
         ORDER BY created_at DESC, id DESC LIMIT 100`,
      )
        .bind(connectorId)
        .all<ExchangeRow>()
      const exchanges: IntegrationExchangeEntity[] = []
      for (const row of rows.results) {
        const exchange = toExchange(row)
        if (exchange instanceof Error) return exchange
        exchanges.push(exchange)
      }
      return Object.freeze(exchanges)
    } catch (cause) {
      return cause instanceof Error ? cause : new Error("failed to find integration exchanges")
    }
  }

  async write(
    exchange: IntegrationExchangeEntity,
    expectedUpdatedAt: Date | null,
    auditStatements: ReadonlyArray<D1PreparedStatement> = [],
  ): Promise<SystemIntegrationExchangeWriteResult> {
    if (expectedUpdatedAt !== null) {
      return this.update(exchange, expectedUpdatedAt, auditStatements)
    }
    try {
      await this.insert(exchange, auditStatements)
      return { kind: "written", exchange, replayed: false }
    } catch (cause) {
      return this.resolveInsertConflict(exchange, cause)
    }
  }

  private async insert(
    exchange: IntegrationExchangeEntity,
    auditStatements: ReadonlyArray<D1PreparedStatement>,
  ): Promise<void> {
    const statements = [
      this.c.env.DB.prepare(
        `INSERT INTO system_integration_exchanges
           (id, connector_id, direction, operation_key, idempotency_key, payload_digest,
            status, attempt, external_reference, last_error_code, created_at, updated_at,
            completed_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)`,
      ).bind(...exchangeValues(exchange)),
      ...auditStatements,
    ]
    const results = await this.c.env.DB.batch(statements)
    if (results.length !== statements.length || results.some((result) => !result.success)) {
      throw new Error("System integration exchange creation batch did not succeed")
    }
  }

  private async update(
    exchange: IntegrationExchangeEntity,
    expectedUpdatedAt: Date,
    auditStatements: ReadonlyArray<D1PreparedStatement>,
  ): Promise<SystemIntegrationExchangeWriteResult> {
    try {
      const statements = [
        this.c.env.DB.prepare(
          `UPDATE system_integration_exchanges
           SET status = ?1, attempt = ?2, external_reference = ?3, last_error_code = ?4,
               updated_at = ?5, completed_at = ?6
           WHERE id = ?7 AND updated_at = ?8`,
        ).bind(
          exchange.status,
          exchange.attempt,
          exchange.externalReference,
          exchange.lastErrorCode,
          exchange.updatedAt.getTime(),
          exchange.completedAt?.getTime() ?? null,
          exchange.id,
          expectedUpdatedAt.getTime(),
        ),
        this.c.env.DB.prepare(
          "SELECT CASE WHEN changes() = 1 THEN 1 ELSE abs(-9223372036854775808) END AS ok",
        ),
        ...auditStatements,
      ]
      const results = await this.c.env.DB.batch(statements)
      if (results.length !== statements.length || results.some((result) => !result.success)) {
        return {
          kind: "unavailable",
          cause: new Error("System integration exchange update batch did not succeed"),
        }
      }
      return { kind: "written", exchange, replayed: false }
    } catch (cause) {
      if (cause instanceof Error && cause.message.includes("integer overflow")) {
        return { kind: "conflict" }
      }
      return { kind: "unavailable", cause }
    }
  }

  private async resolveInsertConflict(
    exchange: IntegrationExchangeEntity,
    cause: unknown,
  ): Promise<SystemIntegrationExchangeWriteResult> {
    const existing = await this.findByIdempotencyKey(exchange.connectorId, exchange.idempotencyKey)
    if (existing instanceof Error) return { kind: "unavailable", cause }
    if (existing === null) return { kind: "unavailable", cause }
    return sameExchangeCommand(existing, exchange)
      ? { kind: "written", exchange: existing, replayed: true }
      : { kind: "conflict" }
  }

  private async findByIdempotencyKey(
    connectorId: string,
    idempotencyKey: string,
  ): Promise<IntegrationExchangeEntity | null | Error> {
    try {
      const row = await this.c.env.DB.prepare(
        `SELECT id, connector_id, direction, operation_key, idempotency_key, payload_digest,
                status, attempt, external_reference, last_error_code,
                created_at, updated_at, completed_at
         FROM system_integration_exchanges
         WHERE connector_id = ?1 AND idempotency_key = ?2 LIMIT 1`,
      )
        .bind(connectorId, idempotencyKey)
        .first<ExchangeRow>()
      return row === null ? null : toExchange(row)
    } catch (cause) {
      return cause instanceof Error ? cause : new Error("failed to find exchange command")
    }
  }
}

function exchangeValues(exchange: IntegrationExchangeEntity) {
  return [
    exchange.id,
    exchange.connectorId,
    exchange.direction,
    exchange.operationKey,
    exchange.idempotencyKey,
    exchange.payloadDigest,
    exchange.status,
    exchange.attempt,
    exchange.externalReference,
    exchange.lastErrorCode,
    exchange.createdAt.getTime(),
    exchange.updatedAt.getTime(),
    exchange.completedAt?.getTime() ?? null,
  ] as const
}

function toExchange(row: ExchangeRow): IntegrationExchangeEntity | Error {
  return IntegrationExchangeEntity.create({
    id: row.id,
    connectorId: row.connector_id,
    direction: row.direction,
    operationKey: row.operation_key,
    idempotencyKey: row.idempotency_key,
    payloadDigest: row.payload_digest,
    status: row.status,
    attempt: row.attempt,
    externalReference: row.external_reference,
    lastErrorCode: row.last_error_code,
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
    completedAt: row.completed_at === null ? null : toDate(row.completed_at),
  })
}

function toDate(value: unknown): unknown {
  return typeof value === "number" ? new Date(value) : value
}

function sameExchangeCommand(
  left: IntegrationExchangeEntity,
  right: IntegrationExchangeEntity,
): boolean {
  return (
    left.direction === right.direction &&
    left.operationKey === right.operationKey &&
    left.payloadDigest === right.payloadDigest
  )
}
