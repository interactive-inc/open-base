import { sql } from "drizzle-orm"
import type { InferSelectModel } from "drizzle-orm"
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
  unique,
  uniqueIndex,
} from "drizzle-orm/sqlite-core"

export const systemConnectors = sqliteTable(
  "system_connectors",
  {
    id: text("id").primaryKey(),
    key: text("key").notNull().unique(),
    name: text("name").notNull(),
    direction: text("direction", { enum: ["inbound", "outbound", "bidirectional"] }).notNull(),
    transport: text("transport", { enum: ["api", "file", "webhook"] }).notNull(),
    status: text("status", { enum: ["active", "disabled"] }).notNull(),
    revision: integer("revision").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("system_connectors_status_idx").on(table.status, table.key),
    check("system_connectors_id_length", sql`length(${table.id}) BETWEEN 1 AND 255`),
    check("system_connectors_key_length", sql`length(${table.key}) BETWEEN 1 AND 63`),
    check("system_connectors_name", sql`length(${table.name}) BETWEEN 1 AND 200`),
    check("system_connectors_revision", sql`${table.revision} >= 1`),
    check("system_connectors_chronology", sql`${table.updatedAt} >= ${table.createdAt}`),
  ],
)

export type SystemConnectorRow = InferSelectModel<typeof systemConnectors>

export const systemIntegrationExchanges = sqliteTable(
  "system_integration_exchanges",
  {
    id: text("id").primaryKey(),
    connectorId: text("connector_id")
      .notNull()
      .references(() => systemConnectors.id, { onDelete: "restrict" }),
    direction: text("direction", { enum: ["inbound", "outbound"] }).notNull(),
    operationKey: text("operation_key").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    payloadDigest: text("payload_digest").notNull(),
    status: text("status", {
      enum: ["pending", "succeeded", "failed", "cancelled"],
    }).notNull(),
    attempt: integer("attempt").notNull(),
    externalReference: text("external_reference"),
    lastErrorCode: text("last_error_code"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    uniqueIndex("system_integration_exchanges_idempotency_uniq").on(
      table.connectorId,
      table.idempotencyKey,
    ),
    index("system_integration_exchanges_status_idx").on(
      table.connectorId,
      table.status,
      table.updatedAt,
    ),
    check("system_integration_exchanges_digest", sql`length(${table.payloadDigest}) = 64`),
    check("system_integration_exchanges_attempt", sql`${table.attempt} BETWEEN 1 AND 100`),
    check("system_integration_exchanges_chronology", sql`${table.updatedAt} >= ${table.createdAt}`),
  ],
)

export type SystemIntegrationExchangeRow = InferSelectModel<typeof systemIntegrationExchanges>

export const systemExternalAssertions = sqliteTable(
  "system_external_assertions",
  {
    id: text("id").primaryKey(),
    connectorId: text("connector_id")
      .notNull()
      .references(() => systemConnectors.id, { onDelete: "restrict" }),
    exchangeId: text("exchange_id").references(() => systemIntegrationExchanges.id, {
      onDelete: "restrict",
    }),
    externalKey: text("external_key").notNull(),
    externalVersion: text("external_version").notNull(),
    payloadDigest: text("payload_digest").notNull(),
    observedAt: integer("observed_at", { mode: "timestamp_ms" }).notNull(),
    receivedAt: integer("received_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("system_external_assertions_version_uniq").on(
      table.connectorId,
      table.externalKey,
      table.externalVersion,
    ),
    index("system_external_assertions_exchange_idx").on(table.exchangeId, table.receivedAt),
    check("system_external_assertions_digest", sql`length(${table.payloadDigest}) = 64`),
    check("system_external_assertions_chronology", sql`${table.receivedAt} >= ${table.observedAt}`),
  ],
)

export type SystemExternalAssertionRow = InferSelectModel<typeof systemExternalAssertions>

export const systemReconciliationRuns = sqliteTable(
  "system_reconciliation_runs",
  {
    id: text("id").primaryKey(),
    exchangeId: text("exchange_id")
      .notNull()
      .references(() => systemIntegrationExchanges.id, { onDelete: "restrict" }),
    assertionId: text("assertion_id")
      .notNull()
      .references(() => systemExternalAssertions.id, { onDelete: "restrict" }),
    localVersion: text("local_version").notNull(),
    status: text("status", { enum: ["matched", "mismatched"] }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("system_reconciliation_runs_input_uniq").on(
      table.exchangeId,
      table.assertionId,
      table.localVersion,
    ),
    index("system_reconciliation_runs_status_idx").on(table.status, table.createdAt),
  ],
)

export type SystemReconciliationRunRow = InferSelectModel<typeof systemReconciliationRuns>

export const systemReconciliationItems = sqliteTable(
  "system_reconciliation_items",
  {
    id: text("id").primaryKey().notNull(),
    runId: text("run_id")
      .notNull()
      .references(() => systemReconciliationRuns.id, { onDelete: "restrict" }),
    itemKey: text("item_key").notNull(),
    localDigest: text("local_digest"),
    externalDigest: text("external_digest"),
    status: text("status", {
      enum: ["matched", "different", "missing_local", "missing_external"],
    }).notNull(),
  },
  (table) => [
    unique("system_reconciliation_items_run_item_uniq").on(table.runId, table.itemKey),
    check(
      "system_reconciliation_items_local_digest",
      sql`${table.localDigest} IS NULL OR length(${table.localDigest}) = 64`,
    ),
    check(
      "system_reconciliation_items_external_digest",
      sql`${table.externalDigest} IS NULL OR length(${table.externalDigest}) = 64`,
    ),
  ],
)

export type SystemReconciliationItemRow = InferSelectModel<typeof systemReconciliationItems>

export const systemIntegrationSchema = {
  systemConnectors,
  systemIntegrationExchanges,
  systemExternalAssertions,
  systemReconciliationRuns,
  systemReconciliationItems,
}
