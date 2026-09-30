DROP TRIGGER IF EXISTS system_decision_candidate_requires_human;
CREATE TRIGGER system_decision_candidate_requires_human
BEFORE INSERT ON system_decision_task_candidates
WHEN NOT EXISTS (
  SELECT 1 FROM system_accounts account
  JOIN system_principals principal ON principal.account_id = account.id
  WHERE account.id = NEW.candidate_account_id AND account.status = 'active' AND account.closed_at IS NULL
    AND account.created_at <= NEW.resolved_at AND principal.kind = 'human' AND principal.created_at <= NEW.resolved_at
)
BEGIN
  SELECT RAISE(ABORT, 'system_decision_candidate_requires_human');
END;
