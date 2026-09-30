import { zAccountId, type AccountId } from "@system/domain/schemas/iam/account-id.schema"
import { proposalDigestSchema } from "@system/domain/schemas/workflow/system-case-reference.schema"
import type { SystemD1Context } from "@system/configuration/system-context"
import type {
  SystemProposalStatus,
  SystemProposalView,
} from "@system/domain/definitions/workflow/system-proposal-view.definition"

export type SystemAttestationView = Readonly<{
  id: string
  taskKey: string
  round: number
  actorAccountId: AccountId
  representedAccountId: AccountId
  delegationId: string | null
  action: "approve" | "reject" | "return"
  comment: string | null
  decidedAt: Date
}>

export type SystemProposalList = Readonly<{
  proposals: ReadonlyArray<SystemProposalView>
  total: number
}>

export type SystemDecisionTaskView = Readonly<{
  key: string
  round: number
  requiredApprovals: number
  requiredParticipants: number
  negativeDecisionRule: "any-reject" | "approval-impossible"
  delegationPolicy: "allowed" | "forbidden"
  returnPolicy: "allowed" | "forbidden"
  openedAt: Date
  dueAt: Date | null
  outcome: "pending" | "approved" | "rejected" | "returned" | "cancelled"
  closedAt: Date | null
}>

export type SystemProposalQuery = Readonly<{
  findByNumber(number: number, version?: number): Promise<SystemProposalView | null | Error>
  list(
    input: Readonly<{
      creatorAccountIds: ReadonlyArray<AccountId> | null
      actorAccountId: AccountId | null
      statuses: ReadonlyArray<SystemProposalStatus> | null
      procedureKey: string | null
      createdFrom: Date | null
      createdTo: Date | null
      includeCancelled: boolean
      sort: "created_at_asc" | "created_at_desc"
      limit: number
      offset: number
      at: Date
    }>,
  ): Promise<SystemProposalList | Error>
  listAttestations(caseId: string): Promise<ReadonlyArray<SystemAttestationView> | Error>
  listTasks(caseId: string): Promise<ReadonlyArray<SystemDecisionTaskView> | Error>
  listTaskCandidateAccountIds(
    input: Readonly<{
      caseId: string
      taskKey: string
      round: number
      at: Date
    }>,
  ): Promise<ReadonlyArray<AccountId> | Error>
  findDelegation(
    input: Readonly<{
      caseId: string
      actorAccountId: AccountId
      candidateAccountIds: ReadonlyArray<AccountId>
      delegationId?: string
      at: Date
    }>,
  ): Promise<Readonly<{ id: string; representedAccountId: AccountId }> | null | Error>
}>

type ProposalRow = Readonly<{
  number: number
  proposal_id: string
  supersedes_proposal_id: string | null
  series_id: string
  version: number
  procedure_key: string
  procedure_revision: number
  procedure_number: number
  title: string
  category: string
  description: string | null
  input_schema_json: string
  decision_policy_json: string
  completion_operation_key: string | null
  body_json: string
  digest: string
  created_by_account_id: string
  created_at: number
  case_id: string
  status: SystemProposalStatus
  updated_at: number
  current_task_key: string | null
  current_task_round: number | null
  current_task_opened_at: number | null
  current_task_due_at: number | null
  last_task_key: string
  last_task_round: number
  last_task_outcome: "pending" | "approved" | "rejected" | "returned" | "cancelled"
}>

type AttestationRow = Readonly<{
  id: string
  task_key: string
  round: number
  actor_account_id: string
  represented_account_id: string
  delegation_id: string | null
  action: "approve" | "reject" | "return"
  comment: string | null
  decided_at: number
}>

const proposalSelect = `SELECT
  number.number,
  proposal.id AS proposal_id,
  proposal.supersedes_proposal_id,
  proposal.series_id,
  proposal.version,
  proposal.procedure_key,
  proposal.procedure_revision,
  procedure_number.number AS procedure_number,
  revision.title,
  revision.category,
  revision.description,
  revision.input_schema_json,
  revision.decision_policy_json,
  revision.completion_operation_key,
  proposal.body_json,
  proposal.digest,
  proposal.created_by_account_id,
  proposal.created_at,
  workflow_case.id AS case_id,
  workflow_case.status,
  workflow_case.updated_at,
  current_task.task_key AS current_task_key,
  current_task.round AS current_task_round,
  current_task.opened_at AS current_task_opened_at,
  current_task.due_at AS current_task_due_at,
  (
    SELECT latest_task.task_key FROM system_decision_tasks AS latest_task
    WHERE latest_task.case_id = workflow_case.id
    ORDER BY latest_task.opened_at DESC, latest_task.rowid DESC LIMIT 1
  ) AS last_task_key,
  (
    SELECT latest_task.round FROM system_decision_tasks AS latest_task
    WHERE latest_task.case_id = workflow_case.id
    ORDER BY latest_task.opened_at DESC, latest_task.rowid DESC LIMIT 1
  ) AS last_task_round,
  coalesce((
    SELECT latest_task.outcome FROM system_decision_tasks AS latest_task
    WHERE latest_task.case_id = workflow_case.id
    ORDER BY latest_task.opened_at DESC, latest_task.rowid DESC LIMIT 1
  ), 'pending') AS last_task_outcome
FROM system_proposal_numbers AS number
JOIN system_proposals AS proposal ON proposal.series_id = number.series_id
JOIN system_procedure_definition_revisions AS revision
  ON revision.procedure_key = proposal.procedure_key
 AND revision.revision = proposal.procedure_revision
JOIN system_procedure_numbers AS procedure_number
  ON procedure_number.procedure_key = proposal.procedure_key
JOIN system_proposal_cases AS proposal_case ON proposal_case.proposal_id = proposal.id
JOIN system_cases AS workflow_case ON workflow_case.id = proposal_case.case_id
LEFT JOIN system_decision_tasks AS current_task
  ON current_task.case_id = workflow_case.id AND current_task.outcome IS NULL`
type Context = SystemD1Context &
  Readonly<{ visibleCompletionOperationKeys?: ReadonlyArray<string | null> }>

/** Systemの判断正本だけを読み、Company表示や業務意味を組み立てないquery adapter。 */
export class SystemD1ProposalAdapter implements SystemProposalQuery {
  constructor(private readonly c: Context) {}

  /** 再送された依頼を申請者・series・版で照合し、別の版や別の申請者へ置き換えない。 */
  async findBySeriesVersion(
    input: Readonly<{
      seriesId: string
      version: number
      creatorAccountId: AccountId
    }>,
  ): Promise<SystemProposalView | null | Error> {
    if (
      input.seriesId.trim().length === 0 ||
      !Number.isSafeInteger(input.version) ||
      input.version <= 0
    )
      return new Error("invalid System proposal series or version")
    try {
      const row = await this.c.env.DB.prepare(
        `${proposalSelect}
         WHERE proposal.series_id = ?1 AND proposal.version = ?2
           AND proposal.created_by_account_id = ?3`,
      )
        .bind(input.seriesId, input.version, input.creatorAccountId)
        .first<ProposalRow>()
      if (row === null) return null
      if (
        this.c.visibleCompletionOperationKeys !== undefined &&
        !this.c.visibleCompletionOperationKeys.includes(row.completion_operation_key)
      )
        return null
      return this.restoreProposal(row)
    } catch (cause) {
      return cause instanceof Error
        ? cause
        : new Error("failed to load System proposal version", { cause })
    }
  }

  async findByNumber(number: number, version?: number): Promise<SystemProposalView | null | Error> {
    if (
      !Number.isSafeInteger(number) ||
      number <= 0 ||
      (version !== undefined && (!Number.isSafeInteger(version) || version <= 0))
    )
      return new Error("invalid System proposal number or version")

    try {
      const row = await this.c.env.DB.prepare(
        `${proposalSelect}
         WHERE number.number = ?1
           AND proposal.version = coalesce(?2, (
             SELECT max(latest.version)
             FROM system_proposals AS latest
             WHERE latest.series_id = proposal.series_id
           ))`,
      )
        .bind(number, version ?? null)
        .first<ProposalRow>()

      return row === null ||
        (this.c.visibleCompletionOperationKeys !== undefined &&
          !this.c.visibleCompletionOperationKeys.includes(row.completion_operation_key))
        ? null
        : this.restoreProposal(row)
    } catch (cause) {
      return cause instanceof Error ? cause : new Error("failed to load system proposal", { cause })
    }
  }

  async list(
    input: Parameters<SystemProposalQuery["list"]>[0],
  ): Promise<SystemProposalList | Error> {
    try {
      const bindings: unknown[] = []
      const conditions = [
        `proposal.version = (
           SELECT max(latest.version)
           FROM system_proposals AS latest
           WHERE latest.series_id = proposal.series_id
         )`,
      ]
      const bind = (value: unknown): string => {
        bindings.push(value)
        return `?${bindings.length}`
      }

      if (this.c.visibleCompletionOperationKeys !== undefined) {
        const keys = this.c.visibleCompletionOperationKeys
        if (keys.length === 0) return { proposals: [], total: 0 }
        const nonNull = keys.filter((key) => key !== null)
        const terms = []
        if (keys.includes(null)) terms.push("revision.completion_operation_key IS NULL")
        if (nonNull.length > 0)
          terms.push(
            `revision.completion_operation_key IN (${nonNull.map((key) => bind(key)).join(", ")})`,
          )
        conditions.push(`(${terms.join(" OR ")})`)
      }
      if (input.creatorAccountIds !== null) {
        if (input.creatorAccountIds.length === 0) return { proposals: [], total: 0 }
        conditions.push(
          `proposal.created_by_account_id IN (${input.creatorAccountIds
            .map((accountId) => bind(accountId))
            .join(", ")})`,
        )
      }
      if (input.actorAccountId !== null) {
        const actor = bind(input.actorAccountId)
        const at = bind(input.at.getTime())
        conditions.push(`EXISTS (
          SELECT 1
          FROM system_decision_tasks AS inbox_task
          JOIN system_decision_task_candidates AS candidate
            ON candidate.case_id = inbox_task.case_id
           AND candidate.task_key = inbox_task.task_key
           AND candidate.round = inbox_task.round
          WHERE inbox_task.case_id = workflow_case.id
            AND inbox_task.outcome IS NULL
            AND (candidate.eligible_from IS NULL OR candidate.eligible_from <= ${at})
            AND (
              candidate.candidate_account_id = ${actor}
              OR EXISTS (
                SELECT 1 FROM system_delegations AS delegation
                WHERE delegation.delegator_account_id = candidate.candidate_account_id
                  AND delegation.delegate_account_id = ${actor}
                  AND delegation.starts_at <= ${at}
                  AND delegation.ends_at > ${at}
                  AND (delegation.revoked_at IS NULL OR delegation.revoked_at > ${at})
                  AND (
                    NOT EXISTS (
                      SELECT 1 FROM system_delegation_procedure_scopes
                      WHERE delegation_id = delegation.id
                    )
                    OR EXISTS (
                      SELECT 1 FROM system_delegation_procedure_scopes
                      WHERE delegation_id = delegation.id
                        AND procedure_key = proposal.procedure_key
                    )
                  )
                  AND (
                    delegation.scope_context IS NULL
                    OR (
                      delegation.scope_context = workflow_case.subject_context
                      AND delegation.scope_kind = workflow_case.subject_kind
                      AND delegation.scope_id = workflow_case.subject_id
                      AND delegation.scope_version = workflow_case.subject_version
                    )
                  )
              )
            )
        )`)
      }
      if (input.statuses !== null) {
        if (input.statuses.length === 0) return { proposals: [], total: 0 }
        conditions.push(
          `workflow_case.status IN (${input.statuses.map((status) => bind(status)).join(", ")})`,
        )
      }
      if (input.procedureKey !== null) {
        conditions.push(`proposal.procedure_key = ${bind(input.procedureKey)}`)
      }
      if (input.createdFrom !== null) {
        conditions.push(`proposal.created_at >= ${bind(input.createdFrom.getTime())}`)
      }
      if (input.createdTo !== null) {
        conditions.push(`proposal.created_at <= ${bind(input.createdTo.getTime())}`)
      }
      if (!input.includeCancelled) conditions.push("workflow_case.status <> 'cancelled'")

      const where = conditions.join(" AND ")
      const totalRow = await this.c.env.DB.prepare(
        `SELECT count(*) AS total FROM (${proposalSelect} WHERE ${where})`,
      )
        .bind(...bindings)
        .first<number>("total")
      const limit = bind(input.limit)
      const offset = bind(input.offset)
      const direction = input.sort === "created_at_asc" ? "ASC" : "DESC"
      const rows = await this.c.env.DB.prepare(
        `${proposalSelect}
         WHERE ${where}
         ORDER BY proposal.created_at ${direction}, number.number ${direction}
         LIMIT ${limit} OFFSET ${offset}`,
      )
        .bind(...bindings)
        .all<ProposalRow>()
      const proposals: SystemProposalView[] = []
      for (const row of rows.results) {
        const proposal = this.restoreProposal(row)
        if (proposal instanceof Error) return proposal
        proposals.push(proposal)
      }

      return { proposals, total: totalRow ?? 0 }
    } catch (cause) {
      return cause instanceof Error
        ? cause
        : new Error("failed to list system proposals", { cause })
    }
  }

  async listAttestations(caseId: string): Promise<ReadonlyArray<SystemAttestationView> | Error> {
    try {
      const rows = await this.c.env.DB.prepare(
        `SELECT id, task_key, round, actor_account_id, represented_account_id,
                delegation_id, action, comment, decided_at
         FROM system_human_attestations
         WHERE case_id = ?1
         ORDER BY decided_at, id`,
      )
        .bind(caseId)
        .all<AttestationRow>()
      const attestations: SystemAttestationView[] = []
      for (const row of rows.results) {
        const actorAccountId = zAccountId.safeParse(row.actor_account_id)
        const representedAccountId = zAccountId.safeParse(row.represented_account_id)
        if (!actorAccountId.success || !representedAccountId.success) {
          return new Error("system attestation contains an invalid AccountEntity ID")
        }
        attestations.push({
          id: row.id,
          taskKey: row.task_key,
          round: row.round,
          actorAccountId: actorAccountId.data,
          representedAccountId: representedAccountId.data,
          delegationId: row.delegation_id,
          action: row.action,
          comment: row.comment,
          decidedAt: new Date(row.decided_at),
        })
      }

      return attestations
    } catch (cause) {
      return cause instanceof Error
        ? cause
        : new Error("failed to list system attestations", { cause })
    }
  }

  async listTasks(caseId: string): Promise<ReadonlyArray<SystemDecisionTaskView> | Error> {
    try {
      const rows = await this.c.env.DB.prepare(
        `SELECT task_key, round, required_approvals, required_participants,
                negative_decision_rule, delegation_policy, return_policy, opened_at, due_at,
                coalesce(outcome, 'pending') AS outcome, closed_at
         FROM system_decision_tasks
         WHERE case_id = ?1
         ORDER BY opened_at, round, task_key`,
      )
        .bind(caseId)
        .all<{
          task_key: string
          round: number
          required_approvals: number
          required_participants: number
          negative_decision_rule: "any-reject" | "approval-impossible"
          delegation_policy: "allowed" | "forbidden"
          return_policy: "allowed" | "forbidden"
          opened_at: number
          due_at: number | null
          outcome: "pending" | "approved" | "rejected" | "returned" | "cancelled"
          closed_at: number | null
        }>()

      return rows.results.map((row) => ({
        key: row.task_key,
        round: row.round,
        requiredApprovals: row.required_approvals,
        requiredParticipants: row.required_participants,
        negativeDecisionRule: row.negative_decision_rule,
        delegationPolicy: row.delegation_policy,
        returnPolicy: row.return_policy,
        openedAt: new Date(row.opened_at),
        dueAt: row.due_at === null ? null : new Date(row.due_at),
        outcome: row.outcome,
        closedAt: row.closed_at === null ? null : new Date(row.closed_at),
      }))
    } catch (cause) {
      return cause instanceof Error
        ? cause
        : new Error("failed to list System decision tasks", { cause })
    }
  }

  async findDelegation(
    input: Parameters<SystemProposalQuery["findDelegation"]>[0],
  ): Promise<
    | Readonly<{ id: string; representedAccountId: ReturnType<typeof zAccountId.parse> }>
    | null
    | Error
  > {
    if (input.candidateAccountIds.length === 0) return null
    try {
      const placeholders = input.candidateAccountIds.map((_, index) => `?${index + 4}`)
      const exactDelegation =
        input.delegationId === undefined
          ? ""
          : `AND delegation.id = ?${input.candidateAccountIds.length + 4}`
      const row = await this.c.env.DB.prepare(
        `SELECT delegation.id, delegation.delegator_account_id
         FROM system_delegations AS delegation
         JOIN system_cases AS workflow_case ON workflow_case.id = ?1
         WHERE delegation.delegate_account_id = ?2
           ${exactDelegation}
           AND delegation.starts_at <= ?3
           AND delegation.ends_at > ?3
           AND (delegation.revoked_at IS NULL OR delegation.revoked_at > ?3)
           AND delegation.delegator_account_id IN (${placeholders.join(", ")})
           AND (
             NOT EXISTS (
               SELECT 1 FROM system_delegation_procedure_scopes
               WHERE delegation_id = delegation.id
             )
             OR EXISTS (
               SELECT 1
               FROM system_delegation_procedure_scopes AS procedure_scope
               JOIN system_proposal_cases AS proposal_case
                 ON proposal_case.case_id = workflow_case.id
               JOIN system_proposals AS proposal ON proposal.id = proposal_case.proposal_id
               WHERE procedure_scope.delegation_id = delegation.id
                 AND procedure_scope.procedure_key = proposal.procedure_key
             )
           )
           AND (
             delegation.scope_context IS NULL
             OR (
               delegation.scope_context = workflow_case.subject_context
               AND delegation.scope_kind = workflow_case.subject_kind
               AND delegation.scope_id = workflow_case.subject_id
               AND delegation.scope_version = workflow_case.subject_version
             )
           )
         ORDER BY delegation.starts_at DESC, delegation.id
         LIMIT 1`,
      )
        .bind(
          input.caseId,
          input.actorAccountId,
          input.at.getTime(),
          ...input.candidateAccountIds,
          ...(input.delegationId === undefined ? [] : [input.delegationId]),
        )
        .first<{ id: string; delegator_account_id: string }>()
      if (row === null) return null
      const representedAccountId = zAccountId.safeParse(row.delegator_account_id)
      return representedAccountId.success
        ? { id: row.id, representedAccountId: representedAccountId.data }
        : new Error("delegation contains an invalid AccountEntity ID")
    } catch (cause) {
      return cause instanceof Error
        ? cause
        : new Error("failed to resolve System delegation", { cause })
    }
  }

  async listTaskCandidateAccountIds(
    input: Parameters<SystemProposalQuery["listTaskCandidateAccountIds"]>[0],
  ): Promise<ReadonlyArray<ReturnType<typeof zAccountId.parse>> | Error> {
    try {
      const rows = await this.c.env.DB.prepare(
        `SELECT candidate_account_id
         FROM system_decision_task_candidates
         WHERE case_id = ?1 AND task_key = ?2 AND round = ?3
           AND (eligible_from IS NULL OR eligible_from <= ?4)
         ORDER BY candidate_account_id`,
      )
        .bind(input.caseId, input.taskKey, input.round, input.at.getTime())
        .all<{ candidate_account_id: string }>()
      const accountIds: ReturnType<typeof zAccountId.parse>[] = []
      for (const row of rows.results) {
        const accountId = zAccountId.safeParse(row.candidate_account_id)
        if (!accountId.success) return new Error("candidate contains an invalid AccountEntity ID")
        accountIds.push(accountId.data)
      }
      return accountIds
    } catch (cause) {
      return cause instanceof Error
        ? cause
        : new Error("failed to list System task candidates", { cause })
    }
  }

  private restoreProposal(row: ProposalRow): SystemProposalView | Error {
    const createdByAccountId = zAccountId.safeParse(row.created_by_account_id)
    const digest = proposalDigestSchema.safeParse(row.digest)
    if (!createdByAccountId.success || !digest.success) {
      return new Error("system proposal contains invalid identity data")
    }

    return {
      number: row.number,
      proposalId: row.proposal_id,
      supersedesProposalId: row.supersedes_proposal_id,
      seriesId: row.series_id,
      version: row.version,
      procedureKey: row.procedure_key,
      procedureRevision: row.procedure_revision,
      procedureNumber: row.procedure_number,
      title: row.title,
      category: row.category,
      description: row.description,
      inputSchemaJson: row.input_schema_json,
      decisionPolicyJson: row.decision_policy_json,
      completionOperationKey: row.completion_operation_key,
      bodyJson: row.body_json,
      digest: digest.data,
      createdByAccountId: createdByAccountId.data,
      createdAt: new Date(row.created_at),
      caseId: row.case_id,
      status: row.status,
      updatedAt: new Date(row.updated_at),
      currentTaskKey: row.current_task_key,
      currentTaskRound: row.current_task_round,
      currentTaskOpenedAt:
        row.current_task_opened_at === null ? null : new Date(row.current_task_opened_at),
      currentTaskDueAt: row.current_task_due_at === null ? null : new Date(row.current_task_due_at),
      lastTaskKey: row.last_task_key,
      lastTaskRound: row.last_task_round,
      lastTaskOutcome: row.last_task_outcome,
    }
  }
}
