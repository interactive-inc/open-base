import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import {
  proposalDigestSchema,
  type ProposalDigest,
} from "@system/domain/schemas/workflow/system-case-reference.schema"
import {
  systemCaseStatusSchema,
  type SystemCaseStatus,
} from "@system/domain/schemas/workflow/system-case.schema"
import type { SystemD1Context } from "@system/configuration/system-context"

export type SystemWorkflowReference = Readonly<{
  number: number
  seriesId: string
  caseId: string
  proposalDigest: ProposalDigest
  status: SystemCaseStatus
  currentTaskKey: string | null
}>
type Context = SystemD1Context

/** Accountが参加したSystem workflowの最小参照情報を、保存schemaを漏らさずまとめて読む。 */
export class ReadSystemWorkflowReferencesAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async readSystemWorkflowReferences(
    input: Readonly<{
      numbers: ReadonlyArray<number>
      actorAccountId: AccountId
      includeAll: boolean
      at: Date
    }>,
  ): Promise<ReadonlyArray<SystemWorkflowReference> | Error> {
    const numbers = [...new Set(input.numbers)]
    if (
      numbers.some((number) => !Number.isSafeInteger(number) || number <= 0) ||
      numbers.length > 10_000 ||
      !Number.isSafeInteger(input.at.getTime())
    ) {
      return new Error("invalid System workflow reference query")
    }
    if (numbers.length === 0) return []

    try {
      const references: SystemWorkflowReference[] = []
      const offsets = Array.from(
        { length: Math.ceil(numbers.length / 80) },
        (_, index) => index * 80,
      )

      for (const offset of offsets) {
        const chunk = numbers.slice(offset, offset + 80)
        const numberPlaceholders = chunk.map((_, index) => `?${index + 1}`)
        const actorPlaceholder = `?${chunk.length + 1}`
        const atPlaceholder = `?${chunk.length + 2}`
        const participant = input.includeAll
          ? "1 = 1"
          : `(proposal.created_by_account_id = ${actorPlaceholder}
          OR EXISTS (
            SELECT 1 FROM system_decision_task_candidates AS candidate
            WHERE candidate.case_id = workflow_case.id
              AND candidate.candidate_account_id = ${actorPlaceholder}
          )
          OR EXISTS (
            SELECT 1 FROM system_human_attestations AS attestation
            WHERE attestation.case_id = workflow_case.id
              AND (
                attestation.actor_account_id = ${actorPlaceholder}
                OR attestation.represented_account_id = ${actorPlaceholder}
              )
          )
          OR EXISTS (
            SELECT 1
            FROM system_delegations AS delegation
            WHERE delegation.delegate_account_id = ${actorPlaceholder}
              AND delegation.starts_at <= ${atPlaceholder}
              AND delegation.ends_at > ${atPlaceholder}
              AND (delegation.revoked_at IS NULL OR delegation.revoked_at > ${atPlaceholder})
              AND EXISTS (
                SELECT 1 FROM system_decision_task_candidates AS delegated_candidate
                WHERE delegated_candidate.case_id = workflow_case.id
                  AND delegated_candidate.candidate_account_id = delegation.delegator_account_id
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
          ))`
        const rows = await this.c.env.DB.prepare(
          `SELECT number.number, proposal.series_id, workflow_case.id AS case_id,
                proposal.digest, workflow_case.status,
                (
                  SELECT task.task_key FROM system_decision_tasks AS task
                  WHERE task.case_id = workflow_case.id AND task.outcome IS NULL
                  ORDER BY task.opened_at DESC, task.round DESC LIMIT 1
                ) AS current_task_key
         FROM system_proposal_numbers AS number
         JOIN system_proposals AS proposal ON proposal.series_id = number.series_id
         JOIN system_proposal_cases AS proposal_case ON proposal_case.proposal_id = proposal.id
         JOIN system_cases AS workflow_case ON workflow_case.id = proposal_case.case_id
         WHERE number.number IN (${numberPlaceholders.join(", ")})
           AND proposal.version = (
             SELECT max(latest.version) FROM system_proposals AS latest
             WHERE latest.series_id = proposal.series_id
           )
           AND ${participant}
         ORDER BY number.number`,
        )
          .bind(
            ...(input.includeAll ? chunk : [...chunk, input.actorAccountId, input.at.getTime()]),
          )
          .all<{
            number: number
            series_id: string
            case_id: string
            digest: string
            status: string
            current_task_key: string | null
          }>()

        for (const row of rows.results) {
          const digest = proposalDigestSchema.safeParse(row.digest)
          const status = systemCaseStatusSchema.safeParse(row.status)
          if (!digest.success || !status.success) {
            return new Error("System workflow contains invalid persisted data")
          }
          references.push({
            number: row.number,
            seriesId: row.series_id,
            caseId: row.case_id,
            proposalDigest: digest.data,
            status: status.data,
            currentTaskKey: row.current_task_key,
          })
        }
      }

      return references
    } catch (caught) {
      return caught instanceof Error
        ? caught
        : new Error("failed to read System workflow references")
    }
  }
}
