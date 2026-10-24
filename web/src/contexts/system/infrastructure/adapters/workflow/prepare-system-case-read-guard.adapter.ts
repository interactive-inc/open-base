import type { SystemD1Context } from "@system/configuration/system-context"

type Context = SystemD1Context

const snapshotSql = `WITH evaluation AS (SELECT max(?3, CAST((julianday('now')-2440587.5)*86400000 AS INTEGER)) AS at)
SELECT json_array(workflow_case.id,workflow_case.status,workflow_case.updated_at,
  (SELECT count(*) FROM system_proposal_cases WHERE case_id=?1),
  (SELECT json_group_array(json_array(task_key,round,outcome,closed_at,due_at,
    due_at IS NOT NULL AND due_at<=(SELECT at FROM evaluation))) FROM (
    SELECT * FROM system_decision_tasks WHERE case_id=?1 ORDER BY task_key,round)),
  (SELECT json_group_array(json_array(candidate_account_id,task_key,round,source,
    eligible_from IS NULL OR eligible_from<=(SELECT at FROM evaluation))) FROM (
    SELECT * FROM system_decision_task_candidates WHERE case_id=?1 ORDER BY task_key,round,candidate_account_id)),
  (SELECT count(*) FROM system_decision_task_exclusions WHERE case_id=?1),
  (SELECT count(*) FROM system_human_attestations WHERE case_id=?1),
  (SELECT json_group_array(json_array(id,status,token_version,closed_at,updated_at,principal_id,kind,revision)) FROM (
    SELECT account.*,principal.id AS principal_id,principal.kind,principal.revision
    FROM system_accounts account LEFT JOIN system_principals principal ON principal.account_id=account.id
    WHERE account.id IN (SELECT candidate_account_id FROM system_decision_task_candidates WHERE case_id=?1)
      OR account.id=workflow_case.created_by_account_id ORDER BY account.id)),
  (SELECT json_group_array(json_array(id,revoked_at,starts_at,ends_at,
    starts_at<=(SELECT at FROM evaluation) AND (SELECT at FROM evaluation)<ends_at
      AND (revoked_at IS NULL OR (SELECT at FROM evaluation)<revoked_at),procedure_key)) FROM (
    SELECT delegation.*,scope.procedure_key FROM system_delegations delegation
    LEFT JOIN system_delegation_procedure_scopes scope ON scope.delegation_id=delegation.id
    WHERE delegation.delegate_account_id=?2 ORDER BY delegation.id))
) AS snapshot FROM system_cases workflow_case WHERE workflow_case.id=?1`

/** 案件の状態・判断候補・委任の変更と時間境界を、開示するtransactionでも検査する。 */
export class PrepareSystemCaseReadGuardAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(input: Readonly<{ caseId: string; accountId: string; at: Date }>) {
    try {
      const snapshot = await this.c.env.DB.prepare(snapshotSql)
        .bind(input.caseId, input.accountId, input.at.getTime())
        .first<string>("snapshot")
      if (snapshot === null) return new Error("case read snapshot is missing")
      return (now: Date) =>
        this.c.env.DB.prepare(`SELECT CASE WHEN EXISTS (
        SELECT 1 FROM (${snapshotSql}) current WHERE current.snapshot=?4
      ) THEN 1 ELSE json_extract('{}','system_case_read_changed') END`).bind(
          input.caseId,
          input.accountId,
          now.getTime(),
          snapshot,
        )
    } catch (cause) {
      return new Error("case read snapshot unavailable", { cause })
    }
  }
}
