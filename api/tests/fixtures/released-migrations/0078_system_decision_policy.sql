-- Extend System decision tasks with participation quorum and generic negative-decision rules.

ALTER TABLE system_decision_tasks
ADD COLUMN required_participants INTEGER NOT NULL DEFAULT 1
  CHECK (required_participants BETWEEN 1 AND 100);

UPDATE system_decision_tasks
SET required_participants = required_approvals;

ALTER TABLE system_decision_tasks
ADD COLUMN negative_decision_rule TEXT NOT NULL DEFAULT 'any-reject'
  CHECK (negative_decision_rule IN ('any-reject', 'approval-impossible'));

ALTER TABLE system_decision_tasks
ADD COLUMN delegation_policy TEXT NOT NULL DEFAULT 'allowed'
  CHECK (delegation_policy IN ('allowed', 'forbidden'));

ALTER TABLE system_decision_tasks
ADD COLUMN return_policy TEXT NOT NULL DEFAULT 'allowed'
  CHECK (return_policy IN ('allowed', 'forbidden'));

DROP TRIGGER IF EXISTS system_decision_tasks_monotonic_lifecycle;

CREATE TRIGGER system_decision_tasks_monotonic_lifecycle
BEFORE UPDATE ON system_decision_tasks
WHEN
  NEW.case_id IS NOT OLD.case_id
  OR NEW.task_key IS NOT OLD.task_key
  OR NEW.round IS NOT OLD.round
  OR NEW.required_approvals IS NOT OLD.required_approvals
  OR NEW.required_participants IS NOT OLD.required_participants
  OR NEW.negative_decision_rule IS NOT OLD.negative_decision_rule
  OR NEW.delegation_policy IS NOT OLD.delegation_policy
  OR NEW.return_policy IS NOT OLD.return_policy
  OR NEW.proposal_digest IS NOT OLD.proposal_digest
  OR NEW.opened_at IS NOT OLD.opened_at
  OR NEW.due_at IS NOT OLD.due_at
  OR OLD.outcome IS NOT NULL
  OR OLD.closed_at IS NOT NULL
  OR NEW.outcome IS NULL
  OR NEW.closed_at IS NULL
BEGIN
  SELECT RAISE(ABORT, 'decision task lifecycle is not monotonic');
END;

DROP TRIGGER IF EXISTS system_decision_tasks_approved_quorum;

CREATE TRIGGER system_decision_tasks_approved_quorum
BEFORE UPDATE OF outcome ON system_decision_tasks
WHEN NEW.outcome = 'approved' AND (
  EXISTS (
    SELECT 1 FROM system_human_attestations
    WHERE
      case_id = NEW.case_id
      AND task_key = NEW.task_key
      AND round = NEW.round
      AND action = 'return'
  )
  OR (
    NEW.negative_decision_rule = 'any-reject'
    AND EXISTS (
      SELECT 1 FROM system_human_attestations
      WHERE
        case_id = NEW.case_id
        AND task_key = NEW.task_key
        AND round = NEW.round
        AND action = 'reject'
    )
  )
  OR (
    SELECT count(*) FROM system_human_attestations
    WHERE
      case_id = NEW.case_id
      AND task_key = NEW.task_key
      AND round = NEW.round
      AND action = 'approve'
  ) < NEW.required_approvals
  OR (
    SELECT count(*) FROM system_human_attestations
    WHERE
      case_id = NEW.case_id
      AND task_key = NEW.task_key
      AND round = NEW.round
  ) < NEW.required_participants
)
BEGIN
  SELECT RAISE(ABORT, 'decision task approval requires quorum');
END;

DROP TRIGGER IF EXISTS system_decision_tasks_negative_evidence;

CREATE TRIGGER system_decision_tasks_negative_evidence
BEFORE UPDATE OF outcome ON system_decision_tasks
WHEN NEW.outcome IN ('rejected', 'returned') AND (
  (
    NEW.outcome = 'returned'
    AND NOT EXISTS (
      SELECT 1 FROM system_human_attestations
      WHERE
        case_id = NEW.case_id
        AND task_key = NEW.task_key
        AND round = NEW.round
        AND action = 'return'
    )
  )
  OR (
    NEW.outcome = 'rejected'
    AND (
      (
        NEW.negative_decision_rule = 'any-reject'
        AND NOT EXISTS (
          SELECT 1 FROM system_human_attestations
          WHERE
            case_id = NEW.case_id
            AND task_key = NEW.task_key
            AND round = NEW.round
            AND action = 'reject'
        )
      )
      OR (
        NEW.negative_decision_rule = 'approval-impossible'
        AND (
          SELECT count(*) FROM system_human_attestations
          WHERE
            case_id = NEW.case_id
            AND task_key = NEW.task_key
            AND round = NEW.round
            AND action = 'reject'
        ) <= (
          SELECT count(*) FROM system_decision_task_candidates
          WHERE
            case_id = NEW.case_id
            AND task_key = NEW.task_key
            AND round = NEW.round
        ) - NEW.required_approvals
      )
    )
  )
)
BEGIN
  SELECT RAISE(ABORT, 'decision task outcome requires matching attestation');
END;

DROP TRIGGER IF EXISTS system_human_attestations_task_policy;

CREATE TRIGGER system_human_attestations_task_policy
BEFORE INSERT ON system_human_attestations
WHEN EXISTS (
  SELECT 1 FROM system_decision_tasks
  WHERE
    case_id = NEW.case_id
    AND task_key = NEW.task_key
    AND round = NEW.round
    AND (
      (delegation_policy = 'forbidden' AND NEW.delegation_id IS NOT NULL)
      OR (return_policy = 'forbidden' AND NEW.action = 'return')
    )
)
BEGIN
  SELECT RAISE(ABORT, 'human attestation violates task policy');
END;
