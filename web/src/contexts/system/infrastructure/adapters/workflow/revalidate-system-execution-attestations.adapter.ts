import type { SystemD1Context } from "@system/configuration/system-context"
import {
  SystemD1ProposalAdapter,
  type SystemAttestationView,
  type SystemDecisionTaskView,
} from "@system/infrastructure/adapters/workflow/system-d1-proposal.adapter"

type Context = SystemD1Context

/** 証言と候補は追記専用。可変のAccount・Principal・委任を実行まで固定する。 */
const snapshotSql = `SELECT json_array(
  (SELECT json_array(status, updated_at) FROM system_cases WHERE id = ?1),
  (SELECT json_group_array(json_array(id, status, token_version)) FROM (
    SELECT id, status, token_version FROM system_accounts WHERE id IN (
      SELECT actor_account_id FROM system_human_attestations WHERE case_id = ?1
      UNION SELECT represented_account_id FROM system_human_attestations WHERE case_id = ?1
    ) ORDER BY id
  )),
  (SELECT json_group_array(json_array(id, account_id, kind, revision)) FROM (
    SELECT id, account_id, kind, revision FROM system_principals WHERE account_id IN (
      SELECT actor_account_id FROM system_human_attestations WHERE case_id = ?1
      UNION SELECT represented_account_id FROM system_human_attestations WHERE case_id = ?1
    ) ORDER BY id
  )),
  (SELECT json_group_array(json_array(id, revoked_at)) FROM (
    SELECT id, revoked_at FROM system_delegations WHERE id IN (
      SELECT delegation_id FROM system_human_attestations WHERE case_id = ?1
    ) ORDER BY id
  )),
  (SELECT json_group_array(json_array(delegation_id, procedure_key)) FROM (
    SELECT delegation_id, procedure_key FROM system_delegation_procedure_scopes
    WHERE delegation_id IN (
      SELECT delegation_id FROM system_human_attestations WHERE case_id = ?1
    ) ORDER BY delegation_id, procedure_key
  ))
) AS snapshot`

/** 実行時点でも有効な人の証言と、同じbatchで検査するガードを返す。 */
export class RevalidateSystemExecutionAttestationsAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(input: Readonly<{ caseId: string; executedAt: Date }>): Promise<
    | Readonly<{
        tasks: ReadonlyArray<SystemDecisionTaskView>
        attestations: ReadonlyArray<SystemAttestationView>
        guard: D1PreparedStatement
      }>
    | Error
  > {
    if (!Number.isSafeInteger(input.executedAt.getTime()))
      return new Error("invalid execution time")
    try {
      const database = this.c.env.DB
      const snapshot = await database
        .prepare(snapshotSql)
        .bind(input.caseId)
        .first<string>("snapshot")
      if (snapshot === null) return new Error("execution evidence snapshot is missing")
      const query = new SystemD1ProposalAdapter(this.c)
      const tasks = await query.listTasks(input.caseId)
      if (tasks instanceof Error) return tasks
      const attestations = await query.listAttestations(input.caseId)
      if (attestations instanceof Error) return attestations
      const valid = await database
        .prepare(`SELECT attestation.id
        FROM system_human_attestations AS attestation
        JOIN system_accounts AS actor ON actor.id = attestation.actor_account_id
        JOIN system_accounts AS represented ON represented.id = attestation.represented_account_id
        JOIN system_principals AS actor_principal ON actor_principal.account_id = actor.id
        JOIN system_principals AS represented_principal ON represented_principal.account_id = represented.id
        JOIN system_cases AS workflow_case ON workflow_case.id = attestation.case_id
        WHERE attestation.case_id = ?1 AND attestation.decided_at <= ?2
          AND actor.status = 'active' AND represented.status = 'active'
          AND actor.closed_at IS NULL AND represented.closed_at IS NULL
          AND actor.created_at <= attestation.decided_at AND represented.created_at <= attestation.decided_at
          AND actor_principal.kind = 'human' AND represented_principal.kind = 'human'
          AND actor_principal.created_at <= attestation.decided_at
          AND represented_principal.created_at <= attestation.decided_at
          AND (
            (attestation.actor_account_id = attestation.represented_account_id AND attestation.delegation_id IS NULL)
            OR EXISTS (
              SELECT 1 FROM system_delegations AS delegation
              WHERE delegation.id = attestation.delegation_id
                AND delegation.delegator_account_id = attestation.represented_account_id
                AND delegation.delegate_account_id = attestation.actor_account_id
                AND delegation.starts_at <= ?2 AND delegation.ends_at > ?2
                AND (delegation.revoked_at IS NULL OR delegation.revoked_at > ?2)
                AND (delegation.scope_context IS NULL OR (
                  delegation.scope_context = workflow_case.subject_context
                  AND delegation.scope_kind = workflow_case.subject_kind
                  AND delegation.scope_id = workflow_case.subject_id
                  AND delegation.scope_version = workflow_case.subject_version
                ))
                AND (NOT EXISTS (
                  SELECT 1 FROM system_delegation_procedure_scopes WHERE delegation_id = delegation.id
                ) OR EXISTS (
                  SELECT 1 FROM system_delegation_procedure_scopes AS scope
                  JOIN system_proposal_cases AS association ON association.case_id = workflow_case.id
                  JOIN system_proposals AS proposal ON proposal.id = association.proposal_id
                  WHERE scope.delegation_id = delegation.id AND scope.procedure_key = proposal.procedure_key
                ))
            )
          )`)
        .bind(input.caseId, input.executedAt.getTime())
        .all<{ id: string }>()
      if (!valid.success) return new Error("failed to read execution witnesses")
      const validIds = new Set(valid.results.map((row) => row.id))
      return {
        tasks,
        attestations: attestations.filter((attestation) => validIds.has(attestation.id)),
        guard: database
          .prepare(`SELECT CASE WHEN snapshot = ?2 THEN 1 ELSE json_extract('', '$') END AS ok
          FROM (${snapshotSql})`)
          .bind(input.caseId, snapshot),
      }
    } catch (cause) {
      return new Error("failed to revalidate execution attestations", { cause })
    }
  }
}
