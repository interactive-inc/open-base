import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import type { ProcedureKey } from "@system/domain/schemas/workflow/procedure-key.schema"
import type {
  ProposalId,
  ProposalSeriesId,
} from "@system/domain/schemas/workflow/proposal-id.schema"
import type { ProposalDigest } from "@system/domain/schemas/workflow/system-case-reference.schema"
import type { SystemCaseId } from "@system/domain/schemas/workflow/system-case.schema"
import { systemAccounts } from "@system/infrastructure/schema/system-core"
import { systemCases } from "@system/infrastructure/schema/system-workflow"
import { sql } from "drizzle-orm"
import type { InferSelectModel } from "drizzle-orm"
import {
  type AnySQLiteColumn,
  check,
  foreignKey,
  index,
  integer,
  sqliteTable,
  text,
  unique,
  uniqueIndex,
} from "drizzle-orm/sqlite-core"

/** 手続の安定した識別子と現在版だけを持つSystem正本。 */
export const systemProcedureDefinitions = sqliteTable(
  "system_procedure_definitions",
  {
    id: text("id")
      .primaryKey()
      .notNull()
      .$defaultFn(() => crypto.randomUUID()),
    key: text("key").notNull().unique().$type<ProcedureKey>(),
    currentRevision: integer("current_revision").notNull(),
    status: text("status", { enum: ["active", "retired"] }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("system_procedure_definitions_status_idx").on(table.status, table.updatedAt),
    check(
      "system_procedure_definitions_key",
      sql`length(${table.key}) BETWEEN 1 AND 100
        AND ${table.key} NOT GLOB '*[^a-z0-9_-]*'
        AND substr(${table.key}, 1, 1) GLOB '[a-z]'`,
    ),
    check("system_procedure_definitions_revision", sql`${table.currentRevision} > 0`),
    check("system_procedure_definitions_status", sql`${table.status} IN ('active', 'retired')`),
    check("system_procedure_definitions_chronology", sql`${table.updatedAt} >= ${table.createdAt}`),
  ],
)

export type SystemProcedureDefinitionRow = InferSelectModel<typeof systemProcedureDefinitions>

/** 手続keyへ一対一で対応し、外部APIで安定参照する単調なSystem番号。 */
export const systemProcedureNumbers = sqliteTable(
  "system_procedure_numbers",
  {
    number: integer("number").primaryKey({ autoIncrement: true }),
    procedureKey: text("procedure_key")
      .notNull()
      .$type<ProcedureKey>()
      .references(() => systemProcedureDefinitions.key, { onDelete: "restrict" }),
  },
  (table) => [uniqueIndex("system_procedure_numbers_key_uniq").on(table.procedureKey)],
)

export type SystemProcedureNumberRow = InferSelectModel<typeof systemProcedureNumbers>

/** 入力schemaと判断方針を追記専用で固定したSystem手続版。 */
export const systemProcedureDefinitionRevisions = sqliteTable(
  "system_procedure_definition_revisions",
  {
    id: text("id")
      .primaryKey()
      .notNull()
      .$defaultFn(() => crypto.randomUUID()),
    procedureKey: text("procedure_key")
      .notNull()
      .$type<ProcedureKey>()
      .references(() => systemProcedureDefinitions.key, {
        onDelete: "restrict",
      }),
    revision: integer("revision").notNull(),
    title: text("title").notNull(),
    category: text("category").notNull(),
    description: text("description"),
    inputSchemaJson: text("input_schema_json").notNull(),
    decisionPolicyJson: text("decision_policy_json").notNull(),
    completionOperationKey: text("completion_operation_key"),
    createdByAccountId: text("created_by_account_id")
      .notNull()
      .$type<AccountId>()
      .references(() => systemAccounts.id, { onDelete: "restrict" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    unique("system_procedure_definition_revisions_revision_uniq").on(
      table.procedureKey,
      table.revision,
    ),
    index("system_procedure_definition_revisions_creator_idx").on(
      table.createdByAccountId,
      table.createdAt,
    ),
    check("system_procedure_definition_revisions_revision", sql`${table.revision} > 0`),
    check(
      "system_procedure_definition_revisions_title",
      sql`length(${table.title}) BETWEEN 1 AND 500`,
    ),
    check(
      "system_procedure_definition_revisions_category",
      sql`length(${table.category}) BETWEEN 1 AND 200`,
    ),
    check(
      "system_procedure_definition_revisions_description",
      sql`${table.description} IS NULL OR length(${table.description}) <= 3000`,
    ),
    check(
      "system_procedure_definition_revisions_json",
      sql`json_valid(${table.inputSchemaJson})
        AND length(${table.inputSchemaJson}) BETWEEN 1 AND 1000000
        AND json_valid(${table.decisionPolicyJson})
        AND length(${table.decisionPolicyJson}) BETWEEN 1 AND 1000000`,
    ),
    check(
      "system_procedure_definition_revisions_operation",
      sql`${table.completionOperationKey} IS NULL
        OR length(${table.completionOperationKey}) BETWEEN 1 AND 100`,
    ),
  ],
)

export type SystemProcedureDefinitionRevisionRow = InferSelectModel<
  typeof systemProcedureDefinitionRevisions
>

/** 同じ提案を修正再提出しても変わらない、追記専用proposal series。 */
export const systemProposalSeries = sqliteTable(
  "system_proposal_series",
  {
    id: text("id").primaryKey().$type<ProposalSeriesId>(),
    procedureKey: text("procedure_key")
      .notNull()
      .$type<ProcedureKey>()
      .references(() => systemProcedureDefinitions.key, { onDelete: "restrict" }),
    createdByAccountId: text("created_by_account_id")
      .notNull()
      .$type<AccountId>()
      .references(() => systemAccounts.id, { onDelete: "restrict" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("system_proposal_series_definition_idx").on(table.procedureKey, table.createdAt),
    index("system_proposal_series_creator_idx").on(table.createdByAccountId, table.createdAt),
    check("system_proposal_series_id", sql`length(${table.id}) BETWEEN 1 AND 255`),
  ],
)

export type SystemProposalSeriesRow = InferSelectModel<typeof systemProposalSeries>

/** 意味を解釈せずcanonical JSON、版、digestを固定したSystem提案。 */
export const systemProposals = sqliteTable(
  "system_proposals",
  {
    id: text("id").primaryKey().$type<ProposalId>(),
    seriesId: text("series_id")
      .notNull()
      .$type<ProposalSeriesId>()
      .references(() => systemProposalSeries.id, { onDelete: "restrict" }),
    version: integer("version").notNull(),
    procedureKey: text("procedure_key").notNull().$type<ProcedureKey>(),
    procedureRevision: integer("procedure_revision").notNull(),
    bodyJson: text("body_json").notNull(),
    digest: text("digest").notNull().$type<ProposalDigest>(),
    createdByAccountId: text("created_by_account_id")
      .notNull()
      .$type<AccountId>()
      .references(() => systemAccounts.id, { onDelete: "restrict" }),
    supersedesProposalId: text("supersedes_proposal_id")
      .$type<ProposalId>()
      .references((): AnySQLiteColumn => systemProposals.id, {
        onDelete: "restrict",
      }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("system_proposals_series_version_uniq").on(table.seriesId, table.version),
    index("system_proposals_definition_idx").on(table.procedureKey, table.procedureRevision),
    index("system_proposals_creator_idx").on(table.createdByAccountId, table.createdAt),
    foreignKey({
      columns: [table.procedureKey, table.procedureRevision],
      foreignColumns: [
        systemProcedureDefinitionRevisions.procedureKey,
        systemProcedureDefinitionRevisions.revision,
      ],
    }).onDelete("restrict"),
    check("system_proposals_id", sql`length(${table.id}) BETWEEN 1 AND 255`),
    check("system_proposals_series", sql`length(${table.seriesId}) BETWEEN 1 AND 255`),
    check("system_proposals_version", sql`${table.version} > 0`),
    check(
      "system_proposals_json",
      sql`json_valid(${table.bodyJson}) AND length(${table.bodyJson}) BETWEEN 1 AND 1000000`,
    ),
    check(
      "system_proposals_digest",
      sql`length(${table.digest}) = 64 AND ${table.digest} NOT GLOB '*[^0-9a-f]*'`,
    ),
    check(
      "system_proposals_lineage",
      sql`(${table.version} = 1 AND ${table.supersedesProposalId} IS NULL)
        OR (${table.version} > 1 AND ${table.supersedesProposalId} IS NOT NULL)`,
    ),
  ],
)

export type SystemProposalRow = InferSelectModel<typeof systemProposals>

/** 外部APIへ公開でき、修正再提出でも変わらない単調なSystem提案系列番号。 */
export const systemProposalNumbers = sqliteTable(
  "system_proposal_numbers",
  {
    number: integer("number").primaryKey({ autoIncrement: true }),
    seriesId: text("series_id")
      .notNull()
      .$type<ProposalSeriesId>()
      .references(() => systemProposalSeries.id, { onDelete: "restrict" }),
  },
  (table) => [uniqueIndex("system_proposal_numbers_series_uniq").on(table.seriesId)],
)

export type SystemProposalNumberRow = InferSelectModel<typeof systemProposalNumbers>

/** 提案版と、そのdigestだけを判断するSystem Caseの一対一対応。 */
export const systemProposalCases = sqliteTable(
  "system_proposal_cases",
  {
    proposalId: text("proposal_id")
      .primaryKey()
      .$type<ProposalId>()
      .references(() => systemProposals.id, { onDelete: "restrict" }),
    caseId: text("case_id")
      .notNull()
      .$type<SystemCaseId>()
      .references(() => systemCases.id, { onDelete: "restrict" }),
    linkedAt: integer("linked_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [uniqueIndex("system_proposal_cases_case_uniq").on(table.caseId)],
)

export type SystemProposalCaseRow = InferSelectModel<typeof systemProposalCases>

export const systemProcedureSchema = {
  systemProcedureDefinitions,
  systemProcedureNumbers,
  systemProcedureDefinitionRevisions,
  systemProposalSeries,
  systemProposals,
  systemProposalNumbers,
  systemProposalCases,
}
