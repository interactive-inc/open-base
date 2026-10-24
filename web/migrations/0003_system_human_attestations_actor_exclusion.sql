-- 委任で判断を記録するとき、操作した Account がこの Task の判断から除外されていても記録できていた。
-- 代理された判断者に加え、操作した Account も除外対象と照合する。SQLite の trigger は置換できないため作り直す。
DROP TRIGGER IF EXISTS system_human_attestations_valid_insert;

CREATE TRIGGER system_human_attestations_valid_insert
BEFORE INSERT ON system_human_attestations
WHEN
  NOT EXISTS (
    SELECT 1
    FROM system_decision_tasks AS task
    JOIN system_cases AS workflow_case ON workflow_case.id = task.case_id
    WHERE
      task.case_id = NEW.case_id
      AND task.task_key = NEW.task_key
      AND task.round = NEW.round
      AND task.closed_at IS NULL
      AND task.proposal_digest = NEW.proposal_digest
      AND workflow_case.status = 'pending'
      AND workflow_case.proposal_digest = NEW.proposal_digest
      AND workflow_case.created_by_account_id <> NEW.actor_account_id
  )
  OR NOT EXISTS (
    SELECT 1 FROM system_decision_task_candidates
    WHERE
      case_id = NEW.case_id
      AND task_key = NEW.task_key
      AND round = NEW.round
      AND candidate_account_id = NEW.represented_account_id
      AND (eligible_from IS NULL OR eligible_from <= NEW.decided_at)
  )
  OR EXISTS (
    SELECT 1 FROM system_decision_task_exclusions
    WHERE
      case_id = NEW.case_id
      AND task_key = NEW.task_key
      AND round = NEW.round
      AND excluded_account_id = NEW.represented_account_id
  )
  OR EXISTS (
    SELECT 1 FROM system_decision_task_exclusions
    WHERE
      case_id = NEW.case_id
      AND task_key = NEW.task_key
      AND round = NEW.round
      AND excluded_account_id = NEW.actor_account_id
  )
  OR (
    NEW.delegation_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM system_delegations AS delegation
      JOIN system_cases AS workflow_case ON workflow_case.id = NEW.case_id
      WHERE
        delegation.id = NEW.delegation_id
        AND delegation.delegator_account_id = NEW.represented_account_id
        AND delegation.delegate_account_id = NEW.actor_account_id
        AND delegation.starts_at <= NEW.decided_at
        AND delegation.ends_at > NEW.decided_at
        AND (delegation.revoked_at IS NULL OR delegation.revoked_at > NEW.decided_at)
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
BEGIN
  SELECT RAISE(ABORT, 'invalid human attestation');
END;
