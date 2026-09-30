import { sql } from "drizzle-orm"
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
  unique,
  type AnySQLiteColumn,
} from "drizzle-orm/sqlite-core"
import { systemAccounts, systemAuditEvents } from "@system/infrastructure/schema/system-core"
import { systemPrincipals } from "@system/infrastructure/schema/system-principal"
import { systemAttachments } from "@system/infrastructure/schema/system-attachment"

export const systemWorkItems = sqliteTable(
  "system_work_items",
  {
    id: text("id").primaryKey().notNull(),
    title: text("title").notNull(),
    instructions: text("instructions").notNull(),
    acceptanceCriteria: text("acceptance_criteria").notNull(),
    createdByAccountId: text("created_by_account_id")
      .notNull()
      .references(() => systemAccounts.id, { onDelete: "restrict" }),
    createdByPrincipalId: text("created_by_principal_id")
      .notNull()
      .references(() => systemPrincipals.id, { onDelete: "restrict" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    dueAt: integer("due_at", { mode: "timestamp_ms" }),
    previousRevisionId: text("previous_revision_id").references(
      (): AnySQLiteColumn => systemWorkItemRevisions.commandId,
      { onDelete: "restrict" },
    ),
  },
  (table) => [
    check("system_work_items_title_length", sql`length(trim(${table.title})) BETWEEN 1 AND 300`),
    check(
      "system_work_items_instructions_length",
      sql`length(trim(${table.instructions})) BETWEEN 1 AND 10000`,
    ),
    check(
      "system_work_items_criteria_length",
      sql`length(trim(${table.acceptanceCriteria})) BETWEEN 1 AND 10000`,
    ),
    check("system_work_items_created_at", sql`${table.createdAt}>=0`),
    check(
      "system_work_items_due_at",
      sql`${table.dueAt} IS NULL OR ${table.dueAt}>=${table.createdAt}`,
    ),
  ],
)

export const systemWorkItemRevisions = sqliteTable(
  "system_work_item_revisions",
  {
    id: text("id").primaryKey().notNull(),
    workItemId: text("work_item_id")
      .notNull()
      .references(() => systemWorkItems.id, { onDelete: "restrict" }),
    revision: integer("revision").notNull(),
    commandId: text("command_id").notNull().unique(),
    action: text("action", {
      enum: [
        "create",
        "accept",
        "submit",
        "approve",
        "return",
        "request_handover",
        "accept_handover",
        "decline_handover",
        "cancel",
      ],
    }).notNull(),
    state: text("state", {
      enum: ["offered", "active", "review_pending", "completed", "cancelled"],
    }).notNull(),
    actorAccountId: text("actor_account_id")
      .notNull()
      .references(() => systemAccounts.id, { onDelete: "restrict" }),
    actorPrincipalId: text("actor_principal_id")
      .notNull()
      .references(() => systemPrincipals.id, { onDelete: "restrict" }),
    accountableAccountId: text("accountable_account_id")
      .notNull()
      .references(() => systemAccounts.id, { onDelete: "restrict" }),
    accountablePrincipalId: text("accountable_principal_id")
      .notNull()
      .references(() => systemPrincipals.id, { onDelete: "restrict" }),
    assigneeAccountId: text("assignee_account_id")
      .notNull()
      .references(() => systemAccounts.id, { onDelete: "restrict" }),
    assigneePrincipalId: text("assignee_principal_id")
      .notNull()
      .references(() => systemPrincipals.id, { onDelete: "restrict" }),
    recordedAt: integer("recorded_at", { mode: "timestamp_ms" }).notNull(),
    snapshotJson: text("snapshot_json").notNull(),
    auditEventId: text("audit_event_id")
      .notNull()
      .unique()
      .references(() => systemAuditEvents.eventId, { onDelete: "restrict" }),
  },
  (table) => [
    unique().on(table.workItemId, table.revision),
    index("system_work_items_accountable_idx").on(
      table.accountableAccountId,
      table.workItemId,
      table.revision,
    ),
    index("system_work_items_assignee_idx").on(
      table.assigneeAccountId,
      table.workItemId,
      table.revision,
    ),
    check(
      "system_work_item_revisions_revision",
      sql`${table.revision} BETWEEN 1 AND 9007199254740991`,
    ),
    check("system_work_item_revisions_recorded_at", sql`${table.recordedAt}>=0`),
    check(
      "system_work_item_revisions_snapshot",
      sql`json_valid(${table.snapshotJson}) AND json_type(${table.snapshotJson})='object' AND length(${table.snapshotJson})<=100000`,
    ),
  ],
)

export const systemWorkEvidence = sqliteTable(
  "system_work_evidence",
  {
    attachmentId: text("attachment_id")
      .primaryKey()
      .notNull()
      .references(() => systemAttachments.id, { onDelete: "restrict" }),
    workItemId: text("work_item_id")
      .notNull()
      .references(() => systemWorkItems.id, { onDelete: "restrict" }),
    plaintextSha256: text("plaintext_sha256").notNull(),
    submittedByAccountId: text("submitted_by_account_id")
      .notNull()
      .references(() => systemAccounts.id, { onDelete: "restrict" }),
    commandId: text("command_id")
      .notNull()
      .references(() => systemWorkItemRevisions.commandId, { onDelete: "restrict" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("system_work_evidence_work_idx").on(table.workItemId, table.attachmentId),
    check(
      "system_work_evidence_digest",
      sql`length(${table.plaintextSha256})=64 AND ${table.plaintextSha256} NOT GLOB '*[^0-9a-f]*'`,
    ),
    check("system_work_evidence_created_at", sql`${table.createdAt}>=0`),
  ],
)

export const systemWorkItemSchema = { systemWorkItems, systemWorkItemRevisions, systemWorkEvidence }
