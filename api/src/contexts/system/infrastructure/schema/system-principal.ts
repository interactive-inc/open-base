import { systemAccounts } from "@system/infrastructure/schema/system-core"
import { systemConnectors } from "@system/infrastructure/schema/system-integration"
import { sql } from "drizzle-orm"
import type { InferSelectModel } from "drizzle-orm"
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"

export const systemPrincipals = sqliteTable(
  "system_principals",
  {
    id: text("id").primaryKey(),
    /** 主キーを UUID へ移す前の値。移行前の記録を現在の行へ辿るために残す。 */
    legacyId: text("legacy_id").unique(),
    accountId: text("account_id")
      .notNull()
      .unique()
      .references(() => systemAccounts.id, { onDelete: "restrict" }),
    kind: text("kind", { enum: ["human", "agent", "service", "connector"] }).notNull(),
    name: text("name").notNull(),
    connectorId: text("connector_id").references(() => systemConnectors.id, {
      onDelete: "restrict",
    }),
    revision: integer("revision").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("system_principals_connector_uniq").on(table.connectorId),
    index("system_principals_kind_idx").on(table.kind, table.id),
    check("system_principals_id", sql`length(${table.id}) BETWEEN 1 AND 255`),
    check("system_principals_name", sql`length(${table.name}) BETWEEN 1 AND 200`),
    check("system_principals_revision", sql`${table.revision} >= 1`),
    check(
      "system_principals_subject",
      sql`(${table.kind} = 'connector') = (${table.connectorId} IS NOT NULL)`,
    ),
    check("system_principals_chronology", sql`${table.updatedAt} >= ${table.createdAt}`),
  ],
)

export type SystemPrincipalRow = InferSelectModel<typeof systemPrincipals>

export const systemMachineCredentials = sqliteTable(
  "system_machine_credentials",
  {
    id: text("id").primaryKey(),
    principalId: text("principal_id")
      .notNull()
      .references(() => systemPrincipals.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    secretHash: text("secret_hash").notNull().unique(),
    status: text("status", { enum: ["active", "revoked"] }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
    lastUsedAt: integer("last_used_at", { mode: "timestamp_ms" }),
    revokedAt: integer("revoked_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    index("system_machine_credentials_principal_idx").on(table.principalId, table.status),
    index("system_machine_credentials_expiration_idx").on(table.expiresAt),
    check("system_machine_credentials_id", sql`length(${table.id}) BETWEEN 1 AND 255`),
    check("system_machine_credentials_name", sql`length(${table.name}) BETWEEN 1 AND 200`),
    check(
      "system_machine_credentials_hash",
      sql`length(${table.secretHash}) = 64 AND ${table.secretHash} NOT GLOB '*[^0-9a-f]*'`,
    ),
    check(
      "system_machine_credentials_chronology",
      sql`${table.updatedAt} >= ${table.createdAt}
        AND (${table.expiresAt} IS NULL OR ${table.expiresAt} > ${table.createdAt})
        AND (${table.lastUsedAt} IS NULL OR (${table.lastUsedAt} >= ${table.createdAt} AND ${table.lastUsedAt} <= ${table.updatedAt}))
        AND ((${table.status} = 'revoked') = (${table.revokedAt} IS NOT NULL))
        AND (${table.revokedAt} IS NULL OR ${table.revokedAt} = ${table.updatedAt})`,
    ),
  ],
)

export type SystemMachineCredentialRow = InferSelectModel<typeof systemMachineCredentials>

export const systemStepUpGrants = sqliteTable(
  "system_step_up_grants",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => systemAccounts.id, { onDelete: "restrict" }),
    tokenHash: text("token_hash").notNull().unique(),
    method: text("method", { enum: ["password", "external_identity"] }).notNull(),
    issuedAt: integer("issued_at", { mode: "timestamp_ms" }).notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    lastUsedAt: integer("last_used_at", { mode: "timestamp_ms" }),
    revokedAt: integer("revoked_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    index("system_step_up_grants_account_idx").on(table.accountId, table.expiresAt),
    check("system_step_up_grants_id", sql`length(${table.id}) BETWEEN 1 AND 255`),
    check(
      "system_step_up_grants_hash",
      sql`length(${table.tokenHash}) = 64 AND ${table.tokenHash} NOT GLOB '*[^0-9a-f]*'`,
    ),
    check("system_step_up_grants_expiration", sql`${table.expiresAt} > ${table.issuedAt}`),
    check(
      "system_step_up_grants_use_chronology",
      sql`${table.lastUsedAt} IS NULL OR (${table.lastUsedAt} >= ${table.issuedAt} AND ${table.lastUsedAt} < ${table.expiresAt})`,
    ),
    check(
      "system_step_up_grants_revocation_chronology",
      sql`${table.revokedAt} IS NULL OR (${table.revokedAt} >= ${table.issuedAt} AND ${table.revokedAt} < ${table.expiresAt})`,
    ),
  ],
)

export type SystemStepUpGrantRow = InferSelectModel<typeof systemStepUpGrants>

export const systemPrincipalSchema = {
  systemPrincipals,
  systemMachineCredentials,
  systemStepUpGrants,
}
