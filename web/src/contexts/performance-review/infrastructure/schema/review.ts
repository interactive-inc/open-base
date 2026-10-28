import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core"

export const reviewCycles = sqliteTable("performance_review_cycles", {
  id: text("id").primaryKey(),
  snapshotJson: text("snapshot_json").notNull(),
  createdByAccountId: text("created_by_account_id").notNull(),
  idempotencyKey: text("idempotency_key").notNull(),
  commandDigest: text("command_digest").notNull(),
  reason: text("reason").notNull(),
  createdAt: text("created_at").notNull(),
})
export const reviewSheets = sqliteTable("performance_review_sheets", {
  id: text("id").primaryKey(),
  cycleId: text("cycle_id").notNull(),
  ownerAccountId: text("owner_account_id").notNull(),
  employeeId: text("employee_id").notNull(),
  revision: integer("revision").notNull(),
  status: text("status").notNull(),
  snapshotJson: text("snapshot_json").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
})
export const reviewSheetRevisions = sqliteTable("performance_review_sheet_revisions", {
  sheetId: text("sheet_id").notNull(),
  revision: integer("revision").notNull(),
  actorAccountId: text("actor_account_id").notNull(),
  operation: text("operation").notNull(),
  reason: text("reason").notNull(),
  detailJson: text("detail_json").notNull(),
  snapshotJson: text("snapshot_json").notNull(),
  commandDigest: text("command_digest").notNull(),
  idempotencyKey: text("idempotency_key").notNull(),
  requestId: text("request_id").notNull(),
  createdAt: text("created_at").notNull(),
})
