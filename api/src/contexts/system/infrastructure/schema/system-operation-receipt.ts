import { sql } from "drizzle-orm"
import { check, index, integer, sqliteTable, text, unique } from "drizzle-orm/sqlite-core"

/** 業務変更と原子的に保存する汎用の完了記録。主体を削除しても履歴の識別子は保全する。 */
export const systemOperationReceipts = sqliteTable(
  "system_operation_receipts",
  {
    id: text("id").primaryKey().notNull(),
    operationKey: text("operation_key").notNull(),
    scopeKey: text("scope_key").notNull(),
    commandId: text("command_id").notNull(),
    actorAccountId: text("actor_account_id").notNull(),
    actorPrincipalId: text("actor_principal_id").notNull(),
    requestDigest: text("request_digest").notNull(),
    resultJson: text("result_json").notNull(),
    resultDigest: text("result_digest").notNull(),
    recordedAt: integer("recorded_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    unique("system_operation_receipts_command_uniq").on(
      table.operationKey,
      table.scopeKey,
      table.commandId,
    ),
    index("system_operation_receipts_actor_idx").on(table.actorAccountId, table.recordedAt),
    ...[
      table.operationKey,
      table.scopeKey,
      table.commandId,
      table.actorAccountId,
      table.actorPrincipalId,
    ].map((column) =>
      check(
        `system_operation_receipts_${column.name}_length`,
        sql`length(${column}) BETWEEN 1 AND 255`,
      ),
    ),
    check(
      "system_operation_receipts_request_digest",
      sql`length(${table.requestDigest}) = 64 AND ${table.requestDigest} NOT GLOB '*[^0-9a-f]*'`,
    ),
    check(
      "system_operation_receipts_result_digest",
      sql`length(${table.resultDigest}) = 64 AND ${table.resultDigest} NOT GLOB '*[^0-9a-f]*'`,
    ),
    check(
      "system_operation_receipts_result_json",
      sql`json_valid(${table.resultJson}) AND length(CAST(${table.resultJson} AS BLOB)) <= 1000000`,
    ),
    check(
      "system_operation_receipts_recorded_at",
      sql`typeof(${table.recordedAt}) = 'integer' AND ${table.recordedAt} BETWEEN 0 AND 9007199254740991`,
    ),
  ],
)

export const systemOperationReceiptSchema = { systemOperationReceipts }
