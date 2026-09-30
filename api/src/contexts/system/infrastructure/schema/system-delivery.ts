import { systemAccounts } from "@system/infrastructure/schema/system-core"
import { sql } from "drizzle-orm"
import type { InferSelectModel } from "drizzle-orm"
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"

export const systemJobs = sqliteTable(
  "system_jobs",
  {
    id: text("id").primaryKey(),
    operationKey: text("operation_key").notNull(),
    handlerKey: text("handler_key"),
    payloadDigest: text("payload_digest").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    createdByAccountId: text("created_by_account_id")
      .notNull()
      .references(() => systemAccounts.id, { onDelete: "restrict" }),
    status: text("status", {
      enum: ["queued", "leased", "succeeded", "dead_letter"],
    }).notNull(),
    attempt: integer("attempt").notNull(),
    maxAttempts: integer("max_attempts").notNull(),
    availableAt: integer("available_at", { mode: "timestamp_ms" }).notNull(),
    leaseAccountId: text("lease_account_id").references(() => systemAccounts.id, {
      onDelete: "restrict",
    }),
    leaseTokenHash: text("lease_token_hash"),
    leaseExpiresAt: integer("lease_expires_at", { mode: "timestamp_ms" }),
    lastErrorCode: text("last_error_code"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    uniqueIndex("system_jobs_idempotency_uniq").on(table.operationKey, table.idempotencyKey),
    index("system_jobs_claim_idx").on(table.status, table.availableAt, table.id),
    index("system_jobs_handler_claim_idx").on(
      table.handlerKey,
      table.status,
      table.availableAt,
      table.id,
    ),
    index("system_jobs_lease_idx").on(table.status, table.leaseExpiresAt),
    check("system_jobs_attempt", sql`${table.attempt} BETWEEN 0 AND ${table.maxAttempts}`),
    check("system_jobs_max_attempts", sql`${table.maxAttempts} BETWEEN 1 AND 100`),
    check(
      "system_jobs_handler_key",
      sql`${table.handlerKey} IS NULL OR length(${table.handlerKey}) BETWEEN 1 AND 200`,
    ),
    check(
      "system_jobs_digest",
      sql`length(${table.payloadDigest}) = 64 AND ${table.payloadDigest} NOT GLOB '*[^0-9a-f]*'`,
    ),
  ],
)

export type SystemJobRow = InferSelectModel<typeof systemJobs>

export const systemOutboxMessages = sqliteTable(
  "system_outbox_messages",
  {
    id: text("id").primaryKey(),
    topic: text("topic").notNull(),
    handlerKey: text("handler_key"),
    sourceContext: text("source_context").notNull(),
    sourceKind: text("source_kind").notNull(),
    sourceId: text("source_id").notNull(),
    sourceVersion: text("source_version").notNull(),
    payloadDigest: text("payload_digest").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    createdByAccountId: text("created_by_account_id")
      .notNull()
      .references(() => systemAccounts.id, { onDelete: "restrict" }),
    status: text("status", {
      enum: ["queued", "leased", "succeeded", "dead_letter"],
    }).notNull(),
    attempt: integer("attempt").notNull(),
    maxAttempts: integer("max_attempts").notNull(),
    availableAt: integer("available_at", { mode: "timestamp_ms" }).notNull(),
    leaseAccountId: text("lease_account_id").references(() => systemAccounts.id, {
      onDelete: "restrict",
    }),
    leaseTokenHash: text("lease_token_hash"),
    leaseExpiresAt: integer("lease_expires_at", { mode: "timestamp_ms" }),
    lastErrorCode: text("last_error_code"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    uniqueIndex("system_outbox_messages_idempotency_uniq").on(table.topic, table.idempotencyKey),
    index("system_outbox_messages_claim_idx").on(table.status, table.availableAt, table.id),
    index("system_outbox_handler_claim_idx").on(
      table.handlerKey,
      table.status,
      table.availableAt,
      table.id,
    ),
    index("system_outbox_messages_lease_idx").on(table.status, table.leaseExpiresAt),
    check(
      "system_outbox_messages_attempt",
      sql`${table.attempt} BETWEEN 0 AND ${table.maxAttempts}`,
    ),
    check("system_outbox_messages_max_attempts", sql`${table.maxAttempts} BETWEEN 1 AND 100`),
    check(
      "system_outbox_handler_key",
      sql`${table.handlerKey} IS NULL OR length(${table.handlerKey}) BETWEEN 1 AND 200`,
    ),
    check(
      "system_outbox_messages_digest",
      sql`length(${table.payloadDigest}) = 64 AND ${table.payloadDigest} NOT GLOB '*[^0-9a-f]*'`,
    ),
  ],
)

export type SystemOutboxMessageRow = InferSelectModel<typeof systemOutboxMessages>

export const systemInboxMessages = sqliteTable(
  "system_inbox_messages",
  {
    id: text("id").primaryKey(),
    sourceKey: text("source_key").notNull(),
    externalMessageId: text("external_message_id").notNull(),
    payloadDigest: text("payload_digest").notNull(),
    status: text("status", { enum: ["accepted", "processed", "rejected"] }).notNull(),
    receivedAt: integer("received_at", { mode: "timestamp_ms" }).notNull(),
    processedAt: integer("processed_at", { mode: "timestamp_ms" }),
    reasonCode: text("reason_code"),
  },
  (table) => [
    uniqueIndex("system_inbox_messages_external_uniq").on(table.sourceKey, table.externalMessageId),
    index("system_inbox_messages_status_idx").on(table.status, table.receivedAt),
    check(
      "system_inbox_messages_digest",
      sql`length(${table.payloadDigest}) = 64 AND ${table.payloadDigest} NOT GLOB '*[^0-9a-f]*'`,
    ),
  ],
)

export type SystemInboxMessageRow = InferSelectModel<typeof systemInboxMessages>

export const systemDeadLetters = sqliteTable(
  "system_dead_letters",
  {
    id: text("id").primaryKey(),
    sourceType: text("source_type", { enum: ["job", "outbox", "inbox"] }).notNull(),
    sourceId: text("source_id").notNull(),
    payloadDigest: text("payload_digest").notNull(),
    reasonCode: text("reason_code").notNull(),
    attempt: integer("attempt").notNull(),
    recordedAt: integer("recorded_at", { mode: "timestamp_ms" }).notNull(),
    requeuedJobId: text("requeued_job_id").references(() => systemJobs.id, {
      onDelete: "restrict",
    }),
    requeuedAt: integer("requeued_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    uniqueIndex("system_dead_letters_source_uniq").on(table.sourceType, table.sourceId),
    index("system_dead_letters_recorded_idx").on(table.recordedAt, table.id),
    check("system_dead_letters_attempt", sql`${table.attempt} BETWEEN 0 AND 100`),
    check(
      "system_dead_letters_digest",
      sql`length(${table.payloadDigest}) = 64 AND ${table.payloadDigest} NOT GLOB '*[^0-9a-f]*'`,
    ),
  ],
)

export type SystemDeadLetterRow = InferSelectModel<typeof systemDeadLetters>

export const systemDeliverySchema = {
  systemJobs,
  systemOutboxMessages,
  systemInboxMessages,
  systemDeadLetters,
}
