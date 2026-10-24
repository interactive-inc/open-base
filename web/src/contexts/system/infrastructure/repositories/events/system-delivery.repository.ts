import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import type { SystemD1Context } from "@system/configuration/system-context"
import { SystemDeliveryEntity } from "@system/domain/entities/system-delivery.entity"

type DeliveryRow = Readonly<{
  id: string
  operation_key: string
  handler_key: string | null
  payload_digest: string
  idempotency_key: string
  status: unknown
  attempt: number
  max_attempts: number
  available_at: number
  lease_account_id: string | null
  lease_token_hash: string | null
  lease_expires_at: number | null
  last_error_code: string | null
  created_at: number
  updated_at: number
  completed_at: number | null
}>

export type SystemOutboxSource = Readonly<{
  topic: string
  sourceContext: string
  sourceKind: string
  sourceId: string
  sourceVersion: string
}>

export type SystemInboxMessageView = Readonly<{
  id: string
  sourceKey: string
  externalMessageId: string
  payloadDigest: string
  status: "accepted" | "processed" | "rejected"
  receivedAt: Date
  processedAt: Date | null
  reasonCode: string | null
}>

export type SystemDeadLetterView = Readonly<{
  id: string
  sourceType: "job" | "outbox" | "inbox"
  sourceId: string
  payloadDigest: string
  reasonCode: string
  attempt: number
  recordedAt: Date
  requeuedJobId: string | null
  requeuedAt: Date | null
}>

export type SystemDeadLetterRequeueResult = Readonly<{
  status: "created" | "replayed"
  jobId: string
}>

type Context = SystemD1Context

/** 汎用job・outbox・inbox・dead letterを同じleaseと冪等性規則で保存する。 */
export class SystemDeliveryRepository {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async findMany(
    kind: "job" | "outbox",
    status: SystemDeliveryEntity["status"] | null,
  ): Promise<ReadonlyArray<SystemDeliveryEntity> | Error> {
    const table = kind === "job" ? "system_jobs" : "system_outbox_messages"
    const operationColumn = kind === "job" ? "operation_key" : "topic"
    try {
      const result = await this.c.env.DB.prepare(
        `SELECT id, ${operationColumn} AS operation_key, handler_key, payload_digest, idempotency_key,
                status, attempt, max_attempts, available_at, lease_account_id,
                lease_token_hash, lease_expires_at, last_error_code, created_at,
                updated_at, completed_at
         FROM ${table}
         WHERE (?1 IS NULL OR status = ?1)
         ORDER BY available_at, id
         LIMIT 100`,
      )
        .bind(status)
        .all<DeliveryRow>()
      if (!result.success) return new Error("failed to list System deliveries")
      const deliveries: SystemDeliveryEntity[] = []
      for (const row of result.results) {
        const delivery = this.restore(kind, row)
        if (delivery instanceof Error) return delivery
        deliveries.push(delivery)
      }
      return Object.freeze(deliveries)
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to list System deliveries")
    }
  }

  /** 登録された処理の期限到来jobだけを上限付きで取り出す。 */
  async findReady(
    input: Readonly<{ handlerKey: string; at: Date; limit: number }>,
  ): Promise<ReadonlyArray<SystemDeliveryEntity> | Error> {
    if (!Number.isSafeInteger(input.limit) || input.limit < 1 || input.limit > 100)
      return new Error("invalid delivery limit")
    try {
      const rows =
        await this.c.env.DB.prepare(`SELECT id, operation_key, handler_key, payload_digest, idempotency_key,
       status, attempt, max_attempts, available_at, lease_account_id, lease_token_hash,
       lease_expires_at, last_error_code, created_at, updated_at, completed_at
       FROM system_jobs WHERE handler_key = ?1 AND
       ((status = 'queued' AND available_at <= ?2) OR (status = 'leased' AND lease_expires_at <= ?2))
       ORDER BY available_at, id LIMIT ?3`)
          .bind(input.handlerKey, input.at.getTime(), input.limit)
          .all<DeliveryRow>()
      if (!rows.success) return new Error("failed to find ready System deliveries")
      const deliveries: SystemDeliveryEntity[] = []
      for (const row of rows.results) {
        const delivery = this.restore("job", row)
        if (delivery instanceof Error) return delivery
        deliveries.push(delivery)
      }
      return deliveries
    } catch (cause) {
      return new Error("failed to find ready System deliveries", { cause })
    }
  }

  async find(kind: "job" | "outbox", id: string): Promise<SystemDeliveryEntity | null | Error> {
    const table = kind === "job" ? "system_jobs" : "system_outbox_messages"
    const operationColumn = kind === "job" ? "operation_key" : "topic"
    try {
      const row = await this.c.env.DB.prepare(
        `SELECT id, ${operationColumn} AS operation_key, handler_key, payload_digest, idempotency_key,
                status, attempt, max_attempts, available_at, lease_account_id,
                lease_token_hash, lease_expires_at, last_error_code, created_at,
                updated_at, completed_at
         FROM ${table} WHERE id = ?1 LIMIT 1`,
      )
        .bind(id)
        .first<DeliveryRow>()
      return row === null ? null : this.restore(kind, row)
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to read System delivery")
    }
  }

  async create(
    delivery: SystemDeliveryEntity,
    createdByAccountId: AccountId,
    outboxSource: SystemOutboxSource | null,
    auditStatements: ReadonlyArray<D1PreparedStatement>,
  ): Promise<"created" | "replayed" | "conflict" | Error> {
    const existing = await this.findByIdempotency(delivery)
    if (existing instanceof Error) return existing
    if (existing !== null) {
      return existing.payloadDigest === delivery.payloadDigest &&
        existing.handlerKey === delivery.handlerKey
        ? "replayed"
        : "conflict"
    }
    if ((delivery.kind === "outbox") !== (outboxSource !== null)) {
      return new Error("System outbox source is invalid")
    }
    try {
      const prepared = this.prepareCreate(delivery, createdByAccountId, outboxSource)
      if (prepared instanceof Error) return prepared
      const statements = [...prepared, ...auditStatements]
      const results = await this.c.env.DB.batch(statements)
      if (results.length !== statements.length || results.some((result) => !result.success)) {
        return new Error("System delivery creation batch did not succeed")
      }
      return "created"
    } catch (caught) {
      const replay = await this.findByIdempotency(delivery)
      if (replay instanceof Error) return replay
      if (replay !== null) {
        return replay.payloadDigest === delivery.payloadDigest &&
          replay.handlerKey === delivery.handlerKey
          ? "replayed"
          : "conflict"
      }
      return caught instanceof Error ? caught : new Error("failed to create System delivery")
    }
  }

  /** 業務の保存とjob登録を同じtransactionへ組み込む。 */
  prepareCreate(
    delivery: SystemDeliveryEntity,
    createdByAccountId: AccountId,
    outboxSource: SystemOutboxSource | null,
  ): ReadonlyArray<D1PreparedStatement> | Error {
    if (
      delivery.status !== "queued" ||
      delivery.attempt !== 0 ||
      (delivery.kind === "outbox") !== (outboxSource !== null)
    )
      return new Error("System delivery creation is invalid")
    if (outboxSource !== null && outboxSource.topic !== delivery.operationKey)
      return new Error("System delivery topic changed")
    const insert =
      delivery.kind === "job"
        ? this.c.env.DB.prepare(
            `INSERT INTO system_jobs
                 (id, operation_key, payload_digest, idempotency_key, created_by_account_id,
                  status, attempt, max_attempts, available_at, lease_account_id,
                  lease_token_hash, lease_expires_at, last_error_code, created_at,
                  updated_at, completed_at, handler_key)
               VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, NULL, NULL, NULL,
                       NULL, ?10, ?10, NULL, ?11)`,
          ).bind(
            delivery.id,
            delivery.operationKey,
            delivery.payloadDigest,
            delivery.idempotencyKey,
            createdByAccountId,
            delivery.status,
            delivery.attempt,
            delivery.maxAttempts,
            delivery.availableAt.getTime(),
            delivery.createdAt.getTime(),
            delivery.handlerKey,
          )
        : this.c.env.DB.prepare(
            `INSERT INTO system_outbox_messages
                 (id, topic, source_context, source_kind, source_id, source_version,
                  payload_digest, idempotency_key, created_by_account_id, status, attempt,
                  max_attempts, available_at, lease_account_id, lease_token_hash,
                  lease_expires_at, last_error_code, created_at, updated_at, completed_at, handler_key)
               VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13,
                       NULL, NULL, NULL, NULL, ?14, ?14, NULL, ?15)`,
          ).bind(
            delivery.id,
            outboxSource?.topic,
            outboxSource?.sourceContext,
            outboxSource?.sourceKind,
            outboxSource?.sourceId,
            outboxSource?.sourceVersion,
            delivery.payloadDigest,
            delivery.idempotencyKey,
            createdByAccountId,
            delivery.status,
            delivery.attempt,
            delivery.maxAttempts,
            delivery.availableAt.getTime(),
            delivery.createdAt.getTime(),
            delivery.handlerKey,
          )
    return [insert]
  }

  async update(
    previous: SystemDeliveryEntity,
    next: SystemDeliveryEntity,
    auditStatements: ReadonlyArray<D1PreparedStatement>,
  ): Promise<"updated" | "conflict" | Error> {
    const prepared = this.prepareUpdate(previous, next)
    if (prepared instanceof Error) return prepared
    try {
      const statements = [...prepared]
      statements.push(...auditStatements)
      const results = await this.c.env.DB.batch(statements)
      if (results.length !== statements.length || results.some((result) => !result.success)) {
        return new Error("System delivery update batch did not succeed")
      }
      return "updated"
    } catch (caught) {
      if (caught instanceof Error && caught.message.includes("integer overflow")) return "conflict"
      return caught instanceof Error ? caught : new Error("failed to update System delivery")
    }
  }

  /** leaseの参照状態を再照合し、業務変更と配信結果を原子的に保存する。 */
  prepareUpdate(
    previous: SystemDeliveryEntity,
    next: SystemDeliveryEntity,
  ): ReadonlyArray<D1PreparedStatement> | Error {
    if (
      previous.id !== next.id ||
      previous.kind !== next.kind ||
      previous.handlerKey !== next.handlerKey ||
      previous.payloadDigest !== next.payloadDigest ||
      previous.operationKey !== next.operationKey ||
      previous.idempotencyKey !== next.idempotencyKey
    ) {
      return new Error("System delivery identity changed")
    }
    const table = next.kind === "job" ? "system_jobs" : "system_outbox_messages"
    const statements: D1PreparedStatement[] = [
      this.c.env.DB.prepare(
        `UPDATE ${table}
           SET status = ?2, attempt = ?3, available_at = ?4, lease_account_id = ?5,
               lease_token_hash = ?6, lease_expires_at = ?7, last_error_code = ?8,
               updated_at = ?9, completed_at = ?10
           WHERE id = ?1 AND status = ?11 AND attempt = ?12 AND updated_at = ?13
             AND lease_account_id IS ?14 AND lease_token_hash IS ?15 AND lease_expires_at IS ?16
             AND available_at = ?17 AND last_error_code IS ?18 AND completed_at IS ?19
             AND handler_key IS ?20 AND payload_digest = ?21 AND idempotency_key = ?22`,
      ).bind(
        next.id,
        next.status,
        next.attempt,
        next.availableAt.getTime(),
        next.leaseAccountId,
        next.leaseTokenHash,
        next.leaseExpiresAt?.getTime() ?? null,
        next.lastErrorCode,
        next.updatedAt.getTime(),
        next.completedAt?.getTime() ?? null,
        previous.status,
        previous.attempt,
        previous.updatedAt.getTime(),
        previous.leaseAccountId,
        previous.leaseTokenHash,
        previous.leaseExpiresAt?.getTime() ?? null,
        previous.availableAt.getTime(),
        previous.lastErrorCode,
        previous.completedAt?.getTime() ?? null,
        previous.handlerKey,
        previous.payloadDigest,
        previous.idempotencyKey,
      ),
      this.c.env.DB.prepare(
        "SELECT CASE WHEN changes() = 1 THEN 1 ELSE abs(-9223372036854775808) END AS ok",
      ),
    ]
    if (next.status === "dead_letter") {
      statements.push(
        this.c.env.DB.prepare(
          `INSERT INTO system_dead_letters
               (id, source_type, source_id, payload_digest, reason_code, attempt,
                recorded_at, requeued_job_id, requeued_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, NULL, NULL)`,
        ).bind(
          crypto.randomUUID(),
          next.kind,
          next.id,
          next.payloadDigest,
          next.lastErrorCode,
          next.attempt,
          next.updatedAt.getTime(),
        ),
      )
    }
    return statements
  }

  async acceptInbox(
    input: Readonly<{
      id: string
      sourceKey: string
      externalMessageId: string
      payloadDigest: string
      receivedAt: Date
    }>,
    auditStatements: ReadonlyArray<D1PreparedStatement>,
  ): Promise<"accepted" | "replayed" | "conflict" | Error> {
    try {
      const existing = await this.c.env.DB.prepare(
        `SELECT payload_digest FROM system_inbox_messages
         WHERE source_key = ?1 AND external_message_id = ?2 LIMIT 1`,
      )
        .bind(input.sourceKey, input.externalMessageId)
        .first<{ payload_digest: string }>()
      if (existing !== null) {
        return existing.payload_digest === input.payloadDigest ? "replayed" : "conflict"
      }
      const statements = [
        this.c.env.DB.prepare(
          `INSERT INTO system_inbox_messages
             (id, source_key, external_message_id, payload_digest, status,
              received_at, processed_at, reason_code)
           VALUES (?1, ?2, ?3, ?4, 'accepted', ?5, NULL, NULL)`,
        ).bind(
          input.id,
          input.sourceKey,
          input.externalMessageId,
          input.payloadDigest,
          input.receivedAt.getTime(),
        ),
        ...auditStatements,
      ]
      const results = await this.c.env.DB.batch(statements)
      if (results.length !== statements.length || results.some((result) => !result.success)) {
        return new Error("System inbox acceptance batch did not succeed")
      }
      return "accepted"
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to accept System inbox message")
    }
  }

  async completeInbox(
    id: string,
    outcome: "processed" | "rejected",
    reasonCode: string | null,
    at: Date,
    auditStatements: ReadonlyArray<D1PreparedStatement>,
  ): Promise<"updated" | "not_found" | "conflict" | Error> {
    const current = await this.findInbox(id)
    if (current === null) return "not_found"
    if (current instanceof Error) return current
    if (current.status !== "accepted") return "conflict"
    if ((outcome === "rejected") !== (reasonCode !== null)) return "conflict"
    try {
      const statements: D1PreparedStatement[] = [
        this.c.env.DB.prepare(
          `UPDATE system_inbox_messages
           SET status = ?2, processed_at = ?3, reason_code = ?4
           WHERE id = ?1 AND status = 'accepted'`,
        ).bind(id, outcome, at.getTime(), reasonCode),
        this.c.env.DB.prepare(
          "SELECT CASE WHEN changes() = 1 THEN 1 ELSE abs(-9223372036854775808) END AS ok",
        ),
      ]
      if (outcome === "rejected") {
        statements.push(
          this.c.env.DB.prepare(
            `INSERT INTO system_dead_letters
               (id, source_type, source_id, payload_digest, reason_code, attempt,
                recorded_at, requeued_job_id, requeued_at)
             VALUES (?1, 'inbox', ?2, ?3, ?4, 0, ?5, NULL, NULL)`,
          ).bind(crypto.randomUUID(), id, current.payloadDigest, reasonCode, at.getTime()),
        )
      }
      statements.push(...auditStatements)
      const results = await this.c.env.DB.batch(statements)
      if (results.length !== statements.length || results.some((result) => !result.success)) {
        return new Error("System inbox completion batch did not succeed")
      }
      return "updated"
    } catch (caught) {
      if (caught instanceof Error && caught.message.includes("integer overflow")) return "conflict"
      return caught instanceof Error ? caught : new Error("failed to complete System inbox message")
    }
  }

  async findDeadLetters(): Promise<ReadonlyArray<SystemDeadLetterView> | Error> {
    try {
      const result = await this.c.env.DB.prepare(
        `SELECT id, source_type, source_id, payload_digest, reason_code, attempt,
                recorded_at, requeued_job_id, requeued_at
         FROM system_dead_letters ORDER BY recorded_at DESC, id LIMIT 100`,
      ).all<{
        id: string
        source_type: "job" | "outbox" | "inbox"
        source_id: string
        payload_digest: string
        reason_code: string
        attempt: number
        recorded_at: number
        requeued_job_id: string | null
        requeued_at: number | null
      }>()
      return Object.freeze(
        result.results.map((row) => ({
          id: row.id,
          sourceType: row.source_type,
          sourceId: row.source_id,
          payloadDigest: row.payload_digest,
          reasonCode: row.reason_code,
          attempt: row.attempt,
          recordedAt: new Date(row.recorded_at),
          requeuedJobId: row.requeued_job_id,
          requeuedAt: row.requeued_at === null ? null : new Date(row.requeued_at),
        })),
      )
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to list System dead letters")
    }
  }

  async findDeadLetter(id: string): Promise<SystemDeadLetterView | null | Error> {
    try {
      const row = await this.c.env.DB.prepare(
        `SELECT id, source_type, source_id, payload_digest, reason_code, attempt,
                recorded_at, requeued_job_id, requeued_at
         FROM system_dead_letters WHERE id = ?1 LIMIT 1`,
      )
        .bind(id)
        .first<{
          id: string
          source_type: "job" | "outbox" | "inbox"
          source_id: string
          payload_digest: string
          reason_code: string
          attempt: number
          recorded_at: number
          requeued_job_id: string | null
          requeued_at: number | null
        }>()
      return row === null ? null : toDeadLetterView(row)
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to read System dead letter")
    }
  }

  async requeueDeadLetter(
    deadLetterId: string,
    job: SystemDeliveryEntity,
    createdByAccountId: AccountId,
    auditStatements: ReadonlyArray<D1PreparedStatement>,
  ): Promise<SystemDeadLetterRequeueResult | "not_found" | "conflict" | Error> {
    if (job.kind !== "job") return new Error("dead letter requeue must create a job")
    const deadLetter = await this.findDeadLetter(deadLetterId)
    if (deadLetter instanceof Error) return deadLetter
    if (deadLetter === null) return "not_found"
    if (deadLetter.requeuedJobId !== null) {
      return { status: "replayed", jobId: deadLetter.requeuedJobId }
    }
    if (job.payloadDigest !== deadLetter.payloadDigest) return "conflict"
    if (deadLetter.sourceType !== "inbox") {
      const source = await this.find(deadLetter.sourceType, deadLetter.sourceId)
      if (source instanceof Error) return source
      if (source === null) return "not_found"
      if (source.handlerKey !== job.handlerKey) return "conflict"
      if (source.handlerKey !== null && source.operationKey !== job.operationKey) return "conflict"
    } else if (job.handlerKey !== null) return "conflict"
    try {
      const statements: D1PreparedStatement[] = [
        this.c.env.DB.prepare(
          `INSERT INTO system_jobs
             (id, operation_key, payload_digest, idempotency_key, created_by_account_id,
              status, attempt, max_attempts, available_at, lease_account_id,
              lease_token_hash, lease_expires_at, last_error_code, created_at,
              updated_at, completed_at, handler_key)
           VALUES (?1, ?2, ?3, ?4, ?5, 'queued', 0, ?6, ?7, NULL, NULL, NULL,
                   NULL, ?8, ?8, NULL, ?9)`,
        ).bind(
          job.id,
          job.operationKey,
          job.payloadDigest,
          job.idempotencyKey,
          createdByAccountId,
          job.maxAttempts,
          job.availableAt.getTime(),
          job.createdAt.getTime(),
          job.handlerKey,
        ),
        this.c.env.DB.prepare(
          `UPDATE system_dead_letters
           SET requeued_job_id = ?2, requeued_at = ?3
           WHERE id = ?1 AND requeued_at IS NULL`,
        ).bind(deadLetterId, job.id, job.createdAt.getTime()),
        this.c.env.DB.prepare(
          "SELECT CASE WHEN changes() = 1 THEN 1 ELSE abs(-9223372036854775808) END AS ok",
        ),
        ...auditStatements,
      ]
      const results = await this.c.env.DB.batch(statements)
      if (results.length !== statements.length || results.some((result) => !result.success)) {
        return new Error("System dead letter requeue batch did not succeed")
      }
      return { status: "created", jobId: job.id }
    } catch (caught) {
      const replay = await this.findDeadLetter(deadLetterId)
      if (replay === null) return "not_found"
      if (!(replay instanceof Error) && replay.requeuedJobId !== null) {
        return { status: "replayed", jobId: replay.requeuedJobId }
      }
      if (caught instanceof Error && caught.message.includes("integer overflow")) {
        return "conflict"
      }
      return caught instanceof Error ? caught : new Error("failed to requeue System dead letter")
    }
  }

  private async findInbox(id: string): Promise<SystemInboxMessageView | null | Error> {
    try {
      const row = await this.c.env.DB.prepare(
        `SELECT id, source_key, external_message_id, payload_digest, status,
                received_at, processed_at, reason_code
         FROM system_inbox_messages WHERE id = ?1 LIMIT 1`,
      )
        .bind(id)
        .first<{
          id: string
          source_key: string
          external_message_id: string
          payload_digest: string
          status: "accepted" | "processed" | "rejected"
          received_at: number
          processed_at: number | null
          reason_code: string | null
        }>()
      return row === null
        ? null
        : {
            id: row.id,
            sourceKey: row.source_key,
            externalMessageId: row.external_message_id,
            payloadDigest: row.payload_digest,
            status: row.status,
            receivedAt: new Date(row.received_at),
            processedAt: row.processed_at === null ? null : new Date(row.processed_at),
            reasonCode: row.reason_code,
          }
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to read System inbox message")
    }
  }

  private async findByIdempotency(
    delivery: SystemDeliveryEntity,
  ): Promise<SystemDeliveryEntity | null | Error> {
    const table = delivery.kind === "job" ? "system_jobs" : "system_outbox_messages"
    const operationColumn = delivery.kind === "job" ? "operation_key" : "topic"
    try {
      const row = await this.c.env.DB.prepare(
        `SELECT id, ${operationColumn} AS operation_key, handler_key, payload_digest, idempotency_key,
                status, attempt, max_attempts, available_at, lease_account_id,
                lease_token_hash, lease_expires_at, last_error_code, created_at,
                updated_at, completed_at
         FROM ${table}
         WHERE ${operationColumn} = ?1 AND idempotency_key = ?2 LIMIT 1`,
      )
        .bind(delivery.operationKey, delivery.idempotencyKey)
        .first<DeliveryRow>()
      return row === null ? null : this.restore(delivery.kind, row)
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to replay System delivery")
    }
  }

  private restore(kind: "job" | "outbox", row: DeliveryRow): SystemDeliveryEntity | Error {
    return SystemDeliveryEntity.create({
      id: row.id,
      kind,
      operationKey: row.operation_key,
      handlerKey: row.handler_key,
      payloadDigest: row.payload_digest,
      idempotencyKey: row.idempotency_key,
      status: row.status,
      attempt: row.attempt,
      maxAttempts: row.max_attempts,
      availableAt: new Date(row.available_at),
      leaseAccountId: row.lease_account_id,
      leaseTokenHash: row.lease_token_hash,
      leaseExpiresAt: row.lease_expires_at === null ? null : new Date(row.lease_expires_at),
      lastErrorCode: row.last_error_code,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      completedAt: row.completed_at === null ? null : new Date(row.completed_at),
    })
  }
}

function toDeadLetterView(
  row: Readonly<{
    id: string
    source_type: "job" | "outbox" | "inbox"
    source_id: string
    payload_digest: string
    reason_code: string
    attempt: number
    recorded_at: number
    requeued_job_id: string | null
    requeued_at: number | null
  }>,
): SystemDeadLetterView {
  return {
    id: row.id,
    sourceType: row.source_type,
    sourceId: row.source_id,
    payloadDigest: row.payload_digest,
    reasonCode: row.reason_code,
    attempt: row.attempt,
    recordedAt: new Date(row.recorded_at),
    requeuedJobId: row.requeued_job_id,
    requeuedAt: row.requeued_at === null ? null : new Date(row.requeued_at),
  }
}
