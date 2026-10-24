import type { AttachmentStatus } from "@system/domain/definitions/attachments/attachment-status.definition"
import { systemAuditEvents } from "@system/infrastructure/schema/system-core"
import { sql } from "drizzle-orm"
import type { InferSelectModel } from "drizzle-orm"
import { check, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

/**
 * 添付のメタデータ。本体は object storage に暗号文で置き、この行が復号鍵と所在を持つ。
 *
 * owner は accountId（System は Employee を知らない）。ファイル名はそれ自体が個人情報に
 * なり得るため object key には含めず、この行だけが保持する。wrappedDek を NULL にすると
 * 現在の行からは復号できなくなる。破棄前の鍵を含むバックアップの失効は別途必要になる。
 */
export const systemAttachments = sqliteTable(
  "system_attachments",
  {
    id: text("id").primaryKey(),
    ownerAccountId: text("owner_account_id").notNull(),
    objectKey: text("object_key").notNull().unique(),
    status: text("status").notNull().$type<AttachmentStatus>(),
    contentType: text("content_type").notNull(),
    byteSize: integer("byte_size").notNull(),
    fileName: text("file_name").notNull(),
    plaintextSha256: text("plaintext_sha256").notNull(),
    wrappedDek: text("wrapped_dek"),
    wrappedDekIv: text("wrapped_dek_iv"),
    contentIv: text("content_iv").notNull(),
    kekVersion: integer("kek_version").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    linkedAt: integer("linked_at", { mode: "timestamp_ms" }),
    erasedAt: integer("erased_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    index("idx_system_attachments_owner_status").on(table.ownerAccountId, table.status),
    index("idx_system_attachments_created_at").on(table.createdAt),
    check(
      "system_attachments_status",
      sql`${table.status} IN ('uploading', 'pending', 'linked', 'erased')`,
    ),
    check("system_attachments_byte_size", sql`${table.byteSize} > 0`),
    check("system_attachments_kek_version", sql`${table.kekVersion} > 0`),
    check(
      "system_attachments_object_key",
      sql`${table.objectKey} LIKE 'att/%' AND length(${table.objectKey}) <= 255`,
    ),
    check(
      "system_attachments_erased_key",
      sql`(${table.status} = 'erased') = (${table.wrappedDek} IS NULL)`,
    ),
  ],
)

export type SystemAttachmentRow = InferSelectModel<typeof systemAttachments>

export const systemAttachmentPreservations = sqliteTable(
  "system_attachment_preservations",
  {
    id: text("id").primaryKey(),
    attachmentId: text("attachment_id").notNull(),
    plaintextSha256: text("plaintext_sha256").notNull(),
    kind: text("kind").notNull().$type<"hold" | "retention">(),
    retainUntil: integer("retain_until", { mode: "timestamp_ms" }),
    reason: text("reason").notNull(),
    createdByAccountId: text("created_by_account_id").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    createdAuditEventId: text("created_audit_event_id")
      .notNull()
      .unique()
      .references(() => systemAuditEvents.eventId),
    revision: integer("revision").notNull(),
    releaseOperationId: text("release_operation_id").unique(),
    releasedByAccountId: text("released_by_account_id"),
    releasedAt: integer("released_at", { mode: "timestamp_ms" }),
    releaseReason: text("release_reason"),
    releaseAuditEventId: text("release_audit_event_id")
      .unique()
      .references(() => systemAuditEvents.eventId),
  },
  (table) => [
    index("system_attachment_preservations_target_idx").on(table.attachmentId, table.id),
    check("system_attachment_preservations_digest", sql`length(${table.plaintextSha256}) = 64`),
    check("system_attachment_preservations_kind", sql`${table.kind} IN ('hold', 'retention')`),
    check(
      "system_attachment_preservations_reason",
      sql`length(trim(${table.reason})) BETWEEN 1 AND 1000`,
    ),
    check("system_attachment_preservations_created_at", sql`${table.createdAt} >= 0`),
    check("system_attachment_preservations_revision", sql`${table.revision} IN (1, 2)`),
    check(
      "system_attachment_preservations_period",
      sql`(${table.kind} = 'hold' AND ${table.retainUntil} IS NULL)
    OR (${table.kind} = 'retention' AND ${table.retainUntil} IS NOT NULL AND ${table.retainUntil} > ${table.createdAt})`,
    ),
    check(
      "system_attachment_preservations_release",
      sql`(${table.revision} = 1 AND ${table.releaseOperationId} IS NULL
    AND ${table.releasedByAccountId} IS NULL AND ${table.releasedAt} IS NULL AND ${table.releaseReason} IS NULL AND ${table.releaseAuditEventId} IS NULL)
    OR (${table.revision} = 2 AND ${table.kind} = 'hold' AND ${table.releaseOperationId} IS NOT NULL
    AND ${table.releasedByAccountId} IS NOT NULL AND ${table.releasedAt} IS NOT NULL AND ${table.releasedAt} >= ${table.createdAt}
    AND ${table.releaseReason} IS NOT NULL AND length(trim(${table.releaseReason})) BETWEEN 1 AND 1000 AND ${table.releaseAuditEventId} IS NOT NULL)`,
    ),
  ],
)

export const systemAttachmentSchema = {
  systemAttachments,
  systemAttachmentPreservations,
}
