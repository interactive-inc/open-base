import { abortWhenPreviousStatementChangedNoRows } from "@/lib/database/abort-when-previous-statement-changed-no-rows"
import { isAbortedByGuard } from "@/lib/database/is-aborted-by-guard"
import type { SystemDecisionTaskBundle } from "@system/domain/definitions/workflow/system-decision-task-bundle.definition"
import type { SystemD1Context } from "@system/configuration/system-context"
import type {
  SystemWorkflowDecisionPersistence,
  SystemWorkflowDecisionResult,
  SystemWorkflowWriter,
} from "@system/domain/definitions/workflow/system-workflow-writer.definition"

type DecisionStateRow = Readonly<{
  case_status: "pending" | "approved" | "rejected" | "returned"
  task_outcome: "pending" | "approved" | "rejected" | "returned"
}>
type Context = SystemD1Context &
  Readonly<{
    decisionGuards?: ReadonlyArray<D1PreparedStatement>
    decisionEffects?: ReadonlyArray<D1PreparedStatement>
    cancelGuards?: ReadonlyArray<D1PreparedStatement>
    cancelEffects?: ReadonlyArray<D1PreparedStatement>
    startGuards?: ReadonlyArray<D1PreparedStatement>
  }>

/** System提案と判断lifecycleをD1 batchで原子的に永続化する。 */
export class SystemD1WorkflowAdapter implements SystemWorkflowWriter {
  constructor(private readonly c: Context) {}

  async start(input: Parameters<SystemWorkflowWriter["start"]>[0]): Promise<number | Error> {
    const database = this.c.env.DB

    try {
      const results = await database.batch<{ number: number }>(this.prepareStartStatements(input))
      const number = results.at(-1)?.results.at(0)?.number

      return number ?? new Error("system proposal number is missing")
    } catch (cause) {
      return cause instanceof Error
        ? cause
        : new Error("failed to start system procedure", { cause })
    }
  }

  /** 上位contextが自分の関連付けを同じD1 batchへ合成するための検証済み永続化部品。 */
  prepareStartStatements(
    input: Parameters<SystemWorkflowWriter["start"]>[0],
  ): D1PreparedStatement[] {
    const database = this.c.env.DB
    const proposal = input.proposal
    const workflowCase = input.workflowCase

    return [
      ...(this.c.startGuards ?? []),
      ...this.prepareSupersededCaseStatements(input),
      ...this.prepareSeriesStatements(input),
      database
        .prepare(
          `INSERT INTO system_proposals
               (id, series_id, version, procedure_key, procedure_revision, body_json,
                digest, created_by_account_id, supersedes_proposal_id, created_at)
             SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10
             WHERE EXISTS (
               SELECT 1 FROM system_accounts WHERE id = ?8 AND status = 'active'
             )`,
        )
        .bind(
          proposal.id,
          proposal.seriesId,
          proposal.version,
          proposal.procedureKey,
          proposal.procedureRevision,
          proposal.bodyJson,
          proposal.digest,
          proposal.createdByAccountId,
          proposal.supersedesProposalId,
          proposal.createdAt.getTime(),
        ),
      abortWhenPreviousStatementChangedNoRows(database),
      database
        .prepare(
          `INSERT INTO system_cases
               (id, subject_context, subject_kind, subject_id, subject_version,
                proposal_digest, created_by_account_id, status, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'pending', ?8, ?8)`,
        )
        .bind(
          workflowCase.id,
          workflowCase.subject.context,
          workflowCase.subject.kind,
          workflowCase.subject.id,
          workflowCase.subject.version,
          workflowCase.proposalDigest,
          workflowCase.createdByAccountId,
          workflowCase.createdAt.getTime(),
        ),
      database
        .prepare(
          `INSERT INTO system_proposal_cases (proposal_id, case_id, linked_at)
             VALUES (?1, ?2, ?3)`,
        )
        .bind(proposal.id, workflowCase.id, workflowCase.createdAt.getTime()),
      this.prepareTaskInsert(input.firstTask),
      ...this.prepareExclusionInserts(input.firstTask),
      ...this.prepareCandidateInserts(input.firstTask, true),
      database
        .prepare("SELECT number FROM system_proposal_numbers WHERE series_id = ?1")
        .bind(proposal.seriesId),
    ]
  }

  async cancel(
    input: Parameters<SystemWorkflowWriter["cancel"]>[0],
  ): Promise<true | "not_found" | "not_pending" | Error> {
    const database = this.c.env.DB
    try {
      const current = await database
        .prepare(
          `SELECT workflow_case.id, workflow_case.status
         FROM system_proposal_numbers AS number
         JOIN system_proposals AS proposal ON proposal.series_id = number.series_id
         JOIN system_proposal_cases AS link ON link.proposal_id = proposal.id
         JOIN system_cases AS workflow_case ON workflow_case.id = link.case_id
         WHERE number.number = ?1
           AND proposal.created_by_account_id = ?2
         ORDER BY proposal.version DESC
         LIMIT 1`,
        )
        .bind(input.number, input.createdByAccountId)
        .first<{ id: string; status: string }>()
      if (current === null) return "not_found"
      if (current.status !== "pending") return "not_pending"

      await database.batch([
        ...(this.c.cancelGuards ?? []),
        database
          .prepare(
            `UPDATE system_decision_tasks
           SET outcome = 'cancelled', closed_at = ?2
           WHERE case_id = ?1 AND outcome IS NULL`,
          )
          .bind(current.id, input.cancelledAt.getTime()),
        database
          .prepare(
            `UPDATE system_cases
           SET status = 'cancelled', updated_at = ?2
           WHERE id = ?1 AND status = 'pending'`,
          )
          .bind(current.id, input.cancelledAt.getTime()),
        abortWhenPreviousStatementChangedNoRows(database),
        ...(this.c.cancelEffects ?? []),
      ])

      return true
    } catch (cause) {
      return cause instanceof Error
        ? cause
        : new Error("failed to cancel system procedure", { cause })
    }
  }

  async reassign(
    input: Parameters<SystemWorkflowWriter["reassign"]>[0],
  ): Promise<true | "not_pending" | Error> {
    const database = this.c.env.DB
    try {
      await database.batch([
        database
          .prepare(
            `UPDATE system_decision_tasks
           SET outcome = 'cancelled', closed_at = ?4
           WHERE case_id = ?1 AND task_key = ?2 AND round = ?3
             AND outcome IS NULL
             AND NOT EXISTS (
               SELECT 1 FROM system_human_attestations
               WHERE case_id = ?1 AND task_key = ?2 AND round = ?3
             )`,
          )
          .bind(input.caseId, input.taskKey, input.round, input.reassignedAt.getTime()),
        abortWhenPreviousStatementChangedNoRows(database),
        this.prepareTaskInsert(input.replacement),
        ...this.prepareExclusionInserts(input.replacement),
        ...this.prepareCandidateInserts(input.replacement, true),
      ])

      return true
    } catch (cause) {
      return isAbortedByGuard(cause)
        ? "not_pending"
        : cause instanceof Error
          ? cause
          : new Error("failed to reassign System task", { cause })
    }
  }

  private prepareSupersededCaseStatements(
    input: Parameters<SystemWorkflowWriter["start"]>[0],
  ): ReadonlyArray<D1PreparedStatement> {
    const proposal = input.proposal
    if (proposal.version === 1) return []

    return [
      this.c.env.DB.prepare(
        `UPDATE system_decision_tasks
         SET outcome = 'cancelled', closed_at = ?2
         WHERE case_id = (
           SELECT link.case_id
           FROM system_proposal_cases AS link
           WHERE link.proposal_id = ?1
         ) AND outcome IS NULL`,
      ).bind(proposal.supersedesProposalId, proposal.createdAt.getTime()),
      this.c.env.DB.prepare(
        `UPDATE system_cases
         SET status = 'cancelled', updated_at = ?2
         WHERE id = (
           SELECT link.case_id
           FROM system_proposal_cases AS link
           WHERE link.proposal_id = ?1
         ) AND status = 'pending'`,
      ).bind(proposal.supersedesProposalId, proposal.createdAt.getTime()),
      this.c.env.DB.prepare(
        `SELECT CASE
           WHEN NOT EXISTS (
             SELECT 1
             FROM system_proposals AS previous
             JOIN system_proposal_numbers AS number
               ON number.series_id = previous.series_id
             JOIN system_proposal_cases AS link ON link.proposal_id = previous.id
             JOIN system_cases AS workflow_case ON workflow_case.id = link.case_id
             WHERE previous.id = ?1
               AND previous.series_id = ?2
               AND previous.version = ?3 - 1
               AND previous.created_by_account_id = ?4
               AND workflow_case.status IN ('returned', 'rejected', 'cancelled')
           ) THEN json_extract('', '$')
           ELSE 1
         END AS valid_supersession`,
      ).bind(
        proposal.supersedesProposalId,
        proposal.seriesId,
        proposal.version,
        proposal.createdByAccountId,
      ),
    ]
  }

  private prepareSeriesStatements(
    input: Parameters<SystemWorkflowWriter["start"]>[0],
  ): ReadonlyArray<D1PreparedStatement> {
    const proposal = input.proposal
    if (proposal.version > 1) return []

    return [
      this.c.env.DB.prepare(
        `INSERT INTO system_proposal_series
           (id, procedure_key, created_by_account_id, created_at)
         SELECT ?1, ?2, ?3, ?4
         WHERE EXISTS (
           SELECT 1 FROM system_accounts WHERE id = ?3 AND status = 'active'
         )`,
      ).bind(
        proposal.seriesId,
        proposal.procedureKey,
        proposal.createdByAccountId,
        proposal.createdAt.getTime(),
      ),
      abortWhenPreviousStatementChangedNoRows(this.c.env.DB),
      this.c.env.DB.prepare("INSERT INTO system_proposal_numbers (series_id) VALUES (?1)").bind(
        proposal.seriesId,
      ),
    ]
  }

  async decide(
    input: SystemWorkflowDecisionPersistence,
  ): Promise<SystemWorkflowDecisionResult | Error> {
    const database = this.c.env.DB
    const attestation = input.attestation

    try {
      const statements: D1PreparedStatement[] = [
        ...(this.c.decisionGuards ?? []),
        database
          .prepare(
            `INSERT INTO system_human_attestations
               (id, case_id, task_key, round, actor_account_id, represented_account_id,
                delegation_id, action, proposal_digest, comment, decided_at)
             SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11
             WHERE EXISTS (
               SELECT 1 FROM system_accounts
               WHERE id = ?5 AND status = 'active' AND closed_at IS NULL AND created_at <= ?11
             )
             AND EXISTS (
               SELECT 1 FROM system_accounts
               WHERE id = ?6 AND status = 'active' AND closed_at IS NULL AND created_at <= ?11
             )
             AND EXISTS (SELECT 1 FROM system_principals WHERE account_id = ?5 AND kind = 'human' AND created_at <= ?11)
             AND EXISTS (SELECT 1 FROM system_principals WHERE account_id = ?6 AND kind = 'human' AND created_at <= ?11)`,
          )
          .bind(
            attestation.id,
            attestation.caseId,
            attestation.taskKey,
            attestation.round,
            attestation.actorAccountId,
            attestation.representedAccountId,
            attestation.delegationId,
            attestation.action,
            attestation.proposalDigest,
            attestation.comment,
            attestation.decidedAt.getTime(),
          ),
        abortWhenPreviousStatementChangedNoRows(database),
        database
          .prepare(
            `UPDATE system_decision_tasks
             SET outcome = CASE
                   WHEN ?5 = 'return' THEN 'returned'
                   WHEN ?5 = 'reject' THEN 'rejected'
                   ELSE 'approved'
                 END,
                 closed_at = ?6
             WHERE case_id = ?1 AND task_key = ?2 AND round = ?3
               AND proposal_digest = ?4
               AND outcome IS NULL
               AND (
                 ?5 = 'return'
                 OR (
                   ?5 = 'reject'
                   AND (
                     negative_decision_rule = 'any-reject'
                     OR (
                       SELECT count(*) FROM system_human_attestations
                       WHERE case_id = ?1 AND task_key = ?2 AND round = ?3
                         AND action = 'reject'
                     ) > (
                       SELECT count(*) FROM system_decision_task_candidates
                       WHERE case_id = ?1 AND task_key = ?2 AND round = ?3
                     ) - required_approvals
                   )
                 )
                 OR (
                   ?5 = 'approve'
                   AND (
                     SELECT count(*) FROM system_human_attestations
                     WHERE case_id = ?1 AND task_key = ?2 AND round = ?3 AND action = 'approve'
                   ) >= required_approvals
                   AND (
                     SELECT count(*) FROM system_human_attestations
                     WHERE case_id = ?1 AND task_key = ?2 AND round = ?3
                   ) >= required_participants
                 )
               )`,
          )
          .bind(
            attestation.caseId,
            attestation.taskKey,
            attestation.round,
            attestation.proposalDigest,
            attestation.action,
            input.decidedAt.getTime(),
          ),
        ...this.prepareNextTaskStatements(input),
        database
          .prepare(
            `UPDATE system_cases
             SET status = CASE
                   WHEN EXISTS (
                     SELECT 1 FROM system_decision_tasks
                     WHERE case_id = ?1 AND outcome = 'rejected'
                   ) THEN 'rejected'
                   WHEN EXISTS (
                     SELECT 1 FROM system_decision_tasks
                     WHERE case_id = ?1 AND outcome = 'returned'
                   ) THEN 'returned'
                   ELSE 'approved'
                 END,
                 updated_at = ?2
             WHERE id = ?1 AND status = 'pending'
               AND NOT EXISTS (
                 SELECT 1 FROM system_decision_tasks
                 WHERE case_id = ?1 AND outcome IS NULL
               )`,
          )
          .bind(attestation.caseId, input.decidedAt.getTime()),
        ...(this.c.decisionEffects ?? []),
        database
          .prepare(
            `SELECT
               workflow_case.status AS case_status,
               coalesce(task.outcome, 'pending') AS task_outcome
             FROM system_cases AS workflow_case
             JOIN system_decision_tasks AS task
               ON task.case_id = workflow_case.id
              AND task.task_key = ?2
              AND task.round = ?3
             WHERE workflow_case.id = ?1`,
          )
          .bind(attestation.caseId, attestation.taskKey, attestation.round),
      ]

      const results = await database.batch<DecisionStateRow>(statements)
      const row = results.at(-1)?.results.at(0)

      return row === undefined
        ? new Error("system decision state is missing")
        : { caseStatus: row.case_status, taskOutcome: row.task_outcome }
    } catch (cause) {
      return cause instanceof Error ? cause : new Error("failed to decide system task", { cause })
    }
  }

  private prepareTaskInsert(input: SystemDecisionTaskBundle): D1PreparedStatement {
    return this.c.env.DB.prepare(
      `INSERT INTO system_decision_tasks
           (case_id, task_key, round, required_approvals, required_participants,
            negative_decision_rule, delegation_policy, return_policy,
            proposal_digest, opened_at, due_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)`,
    ).bind(
      input.task.caseId,
      input.task.key,
      input.task.round,
      input.task.requiredApprovals,
      input.task.requiredParticipants,
      input.task.negativeDecisionRule,
      input.task.delegationPolicy,
      input.task.returnPolicy,
      input.task.proposalDigest,
      input.task.openedAt.getTime(),
      input.task.dueAt?.getTime() ?? null,
    )
  }

  private prepareExclusionInserts(
    input: SystemDecisionTaskBundle,
  ): ReadonlyArray<D1PreparedStatement> {
    return input.exclusions.map((exclusion) =>
      this.c.env.DB.prepare(
        `INSERT INTO system_decision_task_exclusions
             (case_id, task_key, round, excluded_account_id, reason)
           VALUES (?1, ?2, ?3, ?4, ?5)`,
      ).bind(
        input.task.caseId,
        input.task.key,
        input.task.round,
        exclusion.accountId,
        exclusion.reason,
      ),
    )
  }

  private prepareCandidateInserts(
    input: SystemDecisionTaskBundle,
    abortWhenInactive: boolean,
  ): ReadonlyArray<D1PreparedStatement> {
    return input.candidates.flatMap((candidate) => {
      const insert = this.c.env.DB.prepare(
        `INSERT INTO system_decision_task_candidates
             (case_id, task_key, round, candidate_account_id, source,
              evidence_context, evidence_kind, evidence_id, evidence_version,
              eligibility_digest, eligible_from, resolved_at)
           SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12
           WHERE EXISTS (
             SELECT 1 FROM system_accounts WHERE id = ?4 AND status = 'active' AND closed_at IS NULL AND created_at <= ?12
           )
           AND EXISTS (SELECT 1 FROM system_principals WHERE account_id = ?4 AND kind = 'human' AND created_at <= ?12)`,
      ).bind(
        input.task.caseId,
        input.task.key,
        input.task.round,
        candidate.accountId,
        candidate.source,
        candidate.evidenceContext,
        candidate.evidenceKind,
        candidate.evidenceId,
        candidate.evidenceVersion,
        candidate.eligibilityDigest,
        candidate.eligibleFrom?.getTime() ?? null,
        candidate.resolvedAt.getTime(),
      )

      return abortWhenInactive
        ? [insert, abortWhenPreviousStatementChangedNoRows(this.c.env.DB)]
        : [insert]
    })
  }

  private prepareNextTaskStatements(
    input: SystemWorkflowDecisionPersistence,
  ): ReadonlyArray<D1PreparedStatement> {
    if (input.nextTask === null) return []

    const previous = input.attestation
    const task = input.nextTask
    const conditionalTaskInsert = this.c.env.DB.prepare(
      `INSERT INTO system_decision_tasks
           (case_id, task_key, round, required_approvals, required_participants,
            negative_decision_rule, delegation_policy, return_policy,
            proposal_digest, opened_at, due_at)
         SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11
         WHERE EXISTS (
           SELECT 1 FROM system_decision_tasks
           WHERE case_id = ?1 AND task_key = ?12 AND round = ?13 AND outcome = 'approved'
         )`,
    ).bind(
      task.task.caseId,
      task.task.key,
      task.task.round,
      task.task.requiredApprovals,
      task.task.requiredParticipants,
      task.task.negativeDecisionRule,
      task.task.delegationPolicy,
      task.task.returnPolicy,
      task.task.proposalDigest,
      task.task.openedAt.getTime(),
      task.task.dueAt?.getTime() ?? null,
      previous.taskKey,
      previous.round,
    )
    const exclusions = task.exclusions.map((exclusion) =>
      this.c.env.DB.prepare(
        `INSERT INTO system_decision_task_exclusions
             (case_id, task_key, round, excluded_account_id, reason)
           SELECT ?1, ?2, ?3, ?4, ?5
           WHERE EXISTS (
             SELECT 1 FROM system_decision_tasks
             WHERE case_id = ?1 AND task_key = ?2 AND round = ?3 AND outcome IS NULL
           )`,
      ).bind(
        task.task.caseId,
        task.task.key,
        task.task.round,
        exclusion.accountId,
        exclusion.reason,
      ),
    )
    const candidates = task.candidates.map((candidate) =>
      this.c.env.DB.prepare(
        `INSERT INTO system_decision_task_candidates
             (case_id, task_key, round, candidate_account_id, source,
              evidence_context, evidence_kind, evidence_id, evidence_version,
              eligibility_digest, eligible_from, resolved_at)
           SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12
           WHERE EXISTS (
             SELECT 1 FROM system_decision_tasks
             WHERE case_id = ?1 AND task_key = ?2 AND round = ?3 AND outcome IS NULL
           )
           AND EXISTS (
             SELECT 1 FROM system_accounts WHERE id = ?4 AND status = 'active' AND closed_at IS NULL AND created_at <= ?12
           )
           AND EXISTS (SELECT 1 FROM system_principals WHERE account_id = ?4 AND kind = 'human' AND created_at <= ?12)`,
      ).bind(
        task.task.caseId,
        task.task.key,
        task.task.round,
        candidate.accountId,
        candidate.source,
        candidate.evidenceContext,
        candidate.evidenceKind,
        candidate.evidenceId,
        candidate.evidenceVersion,
        candidate.eligibilityDigest,
        candidate.eligibleFrom?.getTime() ?? null,
        candidate.resolvedAt.getTime(),
      ),
    )
    const invariant = this.c.env.DB.prepare(
      `SELECT CASE
           WHEN EXISTS (
             SELECT 1 FROM system_decision_tasks
             WHERE case_id = ?1 AND task_key = ?2 AND round = ?3 AND outcome IS NULL
           ) AND (
             SELECT count(*) FROM system_decision_task_candidates
             WHERE case_id = ?1 AND task_key = ?2 AND round = ?3
           ) <> ?4
           THEN json_extract('', '$')
           ELSE 1
         END AS ok`,
    ).bind(task.task.caseId, task.task.key, task.task.round, task.candidates.length)

    return [conditionalTaskInsert, ...exclusions, ...candidates, invariant]
  }
}
