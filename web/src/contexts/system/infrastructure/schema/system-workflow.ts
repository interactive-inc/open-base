import { systemAccounts } from "@system/infrastructure/schema/system-core"
import { sql } from "drizzle-orm"
import type { InferSelectModel } from "drizzle-orm"
import {
  check,
  foreignKey,
  index,
  integer,
  sqliteTable,
  text,
  unique,
  uniqueIndex,
} from "drizzle-orm/sqlite-core"

/** 業務payloadを持たず、所有contextの対象版と提案digestだけを追跡するSystem案件。 */
export const systemCases = sqliteTable(
  "system_cases",
  {
    id: text("id").primaryKey(),
    subjectContext: text("subject_context").notNull(),
    subjectKind: text("subject_kind").notNull(),
    subjectId: text("subject_id").notNull(),
    subjectVersion: text("subject_version").notNull(),
    proposalDigest: text("proposal_digest").notNull(),
    createdByAccountId: text("created_by_account_id")
      .notNull()
      .references(() => systemAccounts.id, { onDelete: "restrict" }),
    status: text("status", {
      enum: ["pending", "approved", "rejected", "returned", "cancelled", "executed"],
    }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("system_cases_subject_idx").on(
      table.subjectContext,
      table.subjectKind,
      table.subjectId,
      table.subjectVersion,
    ),
    index("system_cases_creator_idx").on(table.createdByAccountId, table.createdAt),
    index("system_cases_status_idx").on(table.status, table.updatedAt),
    check("system_cases_id_length", sql`length(${table.id}) BETWEEN 1 AND 255`),
    check("system_cases_subject_context", sql`length(${table.subjectContext}) BETWEEN 1 AND 100`),
    check("system_cases_subject_kind", sql`length(${table.subjectKind}) BETWEEN 1 AND 100`),
    check("system_cases_subject_id", sql`length(${table.subjectId}) BETWEEN 1 AND 512`),
    check("system_cases_subject_version", sql`length(${table.subjectVersion}) BETWEEN 1 AND 255`),
    check(
      "system_cases_digest",
      sql`length(${table.proposalDigest}) = 64
        AND ${table.proposalDigest} NOT GLOB '*[^0-9a-f]*'`,
    ),
    check(
      "system_cases_status",
      sql`${table.status} IN ('pending', 'approved', 'rejected', 'returned', 'cancelled', 'executed')`,
    ),
    check("system_cases_chronology", sql`${table.updatedAt} >= ${table.createdAt}`),
  ],
)

export type SystemCaseRow = InferSelectModel<typeof systemCases>

/** 候補者、quorum、対象digestを開始時点で固定したSystem判断Task。 */
export const systemDecisionTasks = sqliteTable(
  "system_decision_tasks",
  {
    id: text("id")
      .primaryKey()
      .notNull()
      .$defaultFn(() => crypto.randomUUID()),
    caseId: text("case_id")
      .notNull()
      .references(() => systemCases.id, { onDelete: "restrict" }),
    taskKey: text("task_key").notNull(),
    round: integer("round").notNull(),
    requiredApprovals: integer("required_approvals").notNull(),
    proposalDigest: text("proposal_digest").notNull(),
    openedAt: integer("opened_at", { mode: "timestamp_ms" }).notNull(),
    dueAt: integer("due_at", { mode: "timestamp_ms" }),
    outcome: text("outcome", {
      enum: ["approved", "rejected", "returned", "cancelled"],
    }),
    closedAt: integer("closed_at", { mode: "timestamp_ms" }),
    requiredParticipants: integer("required_participants").notNull(),
    negativeDecisionRule: text("negative_decision_rule", {
      enum: ["any-reject", "approval-impossible"],
    }).notNull(),
    delegationPolicy: text("delegation_policy", { enum: ["allowed", "forbidden"] }).notNull(),
    returnPolicy: text("return_policy", { enum: ["allowed", "forbidden"] }).notNull(),
  },
  (table) => [
    unique("system_decision_tasks_round_uniq").on(table.caseId, table.taskKey, table.round),
    index("system_decision_tasks_open_idx")
      .on(table.dueAt, table.openedAt)
      .where(sql`${table.closedAt} IS NULL`),
    check("system_decision_tasks_key_length", sql`length(${table.taskKey}) BETWEEN 1 AND 100`),
    check("system_decision_tasks_round", sql`${table.round} > 0`),
    check(
      "system_decision_tasks_required_approvals",
      sql`${table.requiredApprovals} BETWEEN 1 AND 100`,
    ),
    check(
      "system_decision_tasks_required_participants",
      sql`${table.requiredParticipants} BETWEEN 1 AND 100`,
    ),
    check(
      "system_decision_tasks_negative_decision_rule",
      sql`${table.negativeDecisionRule} IN ('any-reject', 'approval-impossible')`,
    ),
    check(
      "system_decision_tasks_delegation_policy",
      sql`${table.delegationPolicy} IN ('allowed', 'forbidden')`,
    ),
    check(
      "system_decision_tasks_return_policy",
      sql`${table.returnPolicy} IN ('allowed', 'forbidden')`,
    ),
    check(
      "system_decision_tasks_digest",
      sql`length(${table.proposalDigest}) = 64
        AND ${table.proposalDigest} NOT GLOB '*[^0-9a-f]*'`,
    ),
    check(
      "system_decision_tasks_chronology",
      sql`(${table.dueAt} IS NULL OR ${table.dueAt} >= ${table.openedAt})
        AND (${table.closedAt} IS NULL OR ${table.closedAt} >= ${table.openedAt})`,
    ),
    check(
      "system_decision_tasks_outcome",
      sql`(${table.outcome} IS NULL AND ${table.closedAt} IS NULL)
        OR (${table.outcome} IN ('approved', 'rejected', 'returned', 'cancelled')
          AND ${table.closedAt} IS NOT NULL)`,
    ),
  ],
)

export type SystemDecisionTaskRow = InferSelectModel<typeof systemDecisionTasks>

/** Companyなど所有contextが解決した候補Principalの変更不能なSystem snapshot。 */
export const systemDecisionTaskCandidates = sqliteTable(
  "system_decision_task_candidates",
  {
    id: text("id")
      .primaryKey()
      .notNull()
      .$defaultFn(() => crypto.randomUUID()),
    caseId: text("case_id").notNull(),
    taskKey: text("task_key").notNull(),
    round: integer("round").notNull(),
    candidateAccountId: text("candidate_account_id")
      .notNull()
      .references(() => systemAccounts.id, { onDelete: "restrict" }),
    source: text("source", { enum: ["primary", "escalation"] }).notNull(),
    evidenceContext: text("evidence_context").notNull(),
    evidenceKind: text("evidence_kind").notNull(),
    evidenceId: text("evidence_id").notNull(),
    evidenceVersion: text("evidence_version").notNull(),
    eligibilityDigest: text("eligibility_digest").notNull(),
    eligibleFrom: integer("eligible_from", { mode: "timestamp_ms" }),
    resolvedAt: integer("resolved_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    unique("system_decision_task_candidates_source_uniq").on(
      table.caseId,
      table.taskKey,
      table.round,
      table.candidateAccountId,
      table.source,
    ),
    uniqueIndex("system_decision_task_candidates_account_uniq").on(
      table.caseId,
      table.taskKey,
      table.round,
      table.candidateAccountId,
    ),
    foreignKey({
      columns: [table.caseId, table.taskKey, table.round],
      foreignColumns: [
        systemDecisionTasks.caseId,
        systemDecisionTasks.taskKey,
        systemDecisionTasks.round,
      ],
    }).onDelete("restrict"),
    index("system_decision_task_candidates_account_idx").on(
      table.candidateAccountId,
      table.resolvedAt,
    ),
    check(
      "system_decision_task_candidates_source",
      sql`${table.source} IN ('primary', 'escalation')`,
    ),
    check(
      "system_decision_task_candidates_evidence",
      sql`length(${table.evidenceContext}) BETWEEN 1 AND 100
        AND length(${table.evidenceKind}) BETWEEN 1 AND 100
        AND length(${table.evidenceId}) BETWEEN 1 AND 512
        AND length(${table.evidenceVersion}) BETWEEN 1 AND 255`,
    ),
    check(
      "system_decision_task_candidates_digest",
      sql`length(${table.eligibilityDigest}) = 64
        AND ${table.eligibilityDigest} NOT GLOB '*[^0-9a-f]*'`,
    ),
    check(
      "system_decision_task_candidates_chronology",
      sql`${table.eligibleFrom} IS NULL OR ${table.eligibleFrom} >= ${table.resolvedAt}`,
    ),
    check(
      "system_decision_task_candidates_availability",
      sql`(${table.source} = 'primary' AND ${table.eligibleFrom} IS NULL)
        OR (${table.source} = 'escalation' AND ${table.eligibleFrom} IS NOT NULL)`,
    ),
  ],
)

export type SystemDecisionTaskCandidateRow = InferSelectModel<typeof systemDecisionTaskCandidates>

/** 申請者・対象者など、判断候補へ含めてはならないPrincipalのsnapshot。 */
export const systemDecisionTaskExclusions = sqliteTable(
  "system_decision_task_exclusions",
  {
    id: text("id")
      .primaryKey()
      .notNull()
      .$defaultFn(() => crypto.randomUUID()),
    caseId: text("case_id").notNull(),
    taskKey: text("task_key").notNull(),
    round: integer("round").notNull(),
    excludedAccountId: text("excluded_account_id")
      .notNull()
      .references(() => systemAccounts.id, { onDelete: "restrict" }),
    reason: text("reason", { enum: ["creator", "subject", "policy"] }).notNull(),
  },
  (table) => [
    unique("system_decision_task_exclusions_account_uniq").on(
      table.caseId,
      table.taskKey,
      table.round,
      table.excludedAccountId,
    ),
    foreignKey({
      columns: [table.caseId, table.taskKey, table.round],
      foreignColumns: [
        systemDecisionTasks.caseId,
        systemDecisionTasks.taskKey,
        systemDecisionTasks.round,
      ],
    }).onDelete("restrict"),
    index("system_decision_task_exclusions_account_idx").on(table.excludedAccountId),
    check(
      "system_decision_task_exclusions_reason",
      sql`${table.reason} IN ('creator', 'subject', 'policy')`,
    ),
  ],
)

export type SystemDecisionTaskExclusionRow = InferSelectModel<typeof systemDecisionTaskExclusions>

/** Principal間の限定代理。会社上の責任または権限そのものは移転しない。 */
export const systemDelegations = sqliteTable(
  "system_delegations",
  {
    id: text("id").primaryKey(),
    delegatorAccountId: text("delegator_account_id")
      .notNull()
      .references(() => systemAccounts.id, { onDelete: "restrict" }),
    delegateAccountId: text("delegate_account_id")
      .notNull()
      .references(() => systemAccounts.id, { onDelete: "restrict" }),
    scopeContext: text("scope_context"),
    scopeKind: text("scope_kind"),
    scopeId: text("scope_id"),
    scopeVersion: text("scope_version"),
    startsAt: integer("starts_at", { mode: "timestamp_ms" }).notNull(),
    endsAt: integer("ends_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    revokedAt: integer("revoked_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    index("system_delegations_delegator_idx").on(table.delegatorAccountId, table.startsAt),
    index("system_delegations_delegate_idx").on(table.delegateAccountId, table.startsAt),
    check("system_delegations_id_length", sql`length(${table.id}) BETWEEN 1 AND 255`),
    check(
      "system_delegations_distinct_accounts",
      sql`${table.delegatorAccountId} <> ${table.delegateAccountId}`,
    ),
    check(
      "system_delegations_scope",
      sql`(
        ${table.scopeContext} IS NULL
        AND ${table.scopeKind} IS NULL
        AND ${table.scopeId} IS NULL
        AND ${table.scopeVersion} IS NULL
      ) OR (
        length(${table.scopeContext}) BETWEEN 1 AND 100
        AND length(${table.scopeKind}) BETWEEN 1 AND 100
        AND length(${table.scopeId}) BETWEEN 1 AND 512
        AND length(${table.scopeVersion}) BETWEEN 1 AND 255
      )`,
    ),
    check(
      "system_delegations_chronology",
      sql`${table.endsAt} > ${table.startsAt}
        AND ${table.createdAt} <= ${table.startsAt}
        AND (${table.revokedAt} IS NULL OR (
          ${table.revokedAt} >= ${table.createdAt}
          AND ${table.revokedAt} <= ${table.endsAt}
        ))`,
    ),
  ],
)

export type SystemDelegationRow = InferSelectModel<typeof systemDelegations>

/** 特定taskと提案digestへ人間が行ったappend-onlyな判断証明。 */
export const systemHumanAttestations = sqliteTable(
  "system_human_attestations",
  {
    id: text("id").primaryKey(),
    caseId: text("case_id").notNull(),
    taskKey: text("task_key").notNull(),
    round: integer("round").notNull(),
    actorAccountId: text("actor_account_id")
      .notNull()
      .references(() => systemAccounts.id, { onDelete: "restrict" }),
    representedAccountId: text("represented_account_id")
      .notNull()
      .references(() => systemAccounts.id, { onDelete: "restrict" }),
    delegationId: text("delegation_id").references(() => systemDelegations.id, {
      onDelete: "restrict",
    }),
    action: text("action", { enum: ["approve", "reject", "return"] }).notNull(),
    proposalDigest: text("proposal_digest").notNull(),
    comment: text("comment"),
    decidedAt: integer("decided_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.caseId, table.taskKey, table.round],
      foreignColumns: [
        systemDecisionTasks.caseId,
        systemDecisionTasks.taskKey,
        systemDecisionTasks.round,
      ],
    }).onDelete("restrict"),
    uniqueIndex("system_human_attestations_actor_uniq").on(
      table.caseId,
      table.taskKey,
      table.round,
      table.actorAccountId,
    ),
    uniqueIndex("system_human_attestations_represented_uniq").on(
      table.caseId,
      table.taskKey,
      table.round,
      table.representedAccountId,
    ),
    index("system_human_attestations_decided_idx").on(table.decidedAt),
    check("system_human_attestations_id_length", sql`length(${table.id}) BETWEEN 1 AND 255`),
    check(
      "system_human_attestations_action",
      sql`${table.action} IN ('approve', 'reject', 'return')`,
    ),
    check(
      "system_human_attestations_delegation",
      sql`(
        ${table.actorAccountId} = ${table.representedAccountId}
        AND ${table.delegationId} IS NULL
      ) OR (
        ${table.actorAccountId} <> ${table.representedAccountId}
        AND ${table.delegationId} IS NOT NULL
      )`,
    ),
    check(
      "system_human_attestations_digest",
      sql`length(${table.proposalDigest}) = 64
        AND ${table.proposalDigest} NOT GLOB '*[^0-9a-f]*'`,
    ),
    check(
      "system_human_attestations_comment",
      sql`${table.comment} IS NULL OR length(${table.comment}) <= 4000`,
    ),
  ],
)

export type SystemHumanAttestationRow = InferSelectModel<typeof systemHumanAttestations>

/** 承認済み提案digestへだけ使用できる期限付き一回実行許可。 */
export const systemExecutionAuthorizations = sqliteTable(
  "system_execution_authorizations",
  {
    id: text("id").primaryKey(),
    caseId: text("case_id")
      .notNull()
      .references(() => systemCases.id, { onDelete: "restrict" }),
    operationKey: text("operation_key").notNull(),
    proposalDigest: text("proposal_digest").notNull(),
    grantedToAccountId: text("granted_to_account_id")
      .notNull()
      .references(() => systemAccounts.id, { onDelete: "restrict" }),
    grantedAt: integer("granted_at", { mode: "timestamp_ms" }).notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    usedAt: integer("used_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    uniqueIndex("system_execution_authorizations_case_operation_uniq").on(
      table.caseId,
      table.operationKey,
    ),
    index("system_execution_authorizations_grantee_idx").on(
      table.grantedToAccountId,
      table.grantedAt,
    ),
    check("system_execution_authorizations_id_length", sql`length(${table.id}) BETWEEN 1 AND 255`),
    check(
      "system_execution_authorizations_operation_key_length",
      sql`length(${table.operationKey}) BETWEEN 1 AND 100`,
    ),
    check(
      "system_execution_authorizations_digest",
      sql`length(${table.proposalDigest}) = 64
        AND ${table.proposalDigest} NOT GLOB '*[^0-9a-f]*'`,
    ),
    check(
      "system_execution_authorizations_chronology",
      sql`${table.expiresAt} > ${table.grantedAt}
        AND (${table.usedAt} IS NULL OR (
          ${table.usedAt} >= ${table.grantedAt} AND ${table.usedAt} < ${table.expiresAt}
        ))`,
    ),
  ],
)

export type SystemExecutionAuthorizationRow = InferSelectModel<typeof systemExecutionAuthorizations>

export const systemWorkflowSchema = {
  systemCases,
  systemDecisionTasks,
  systemDecisionTaskCandidates,
  systemDecisionTaskExclusions,
  systemDelegations,
  systemHumanAttestations,
  systemExecutionAuthorizations,
}
