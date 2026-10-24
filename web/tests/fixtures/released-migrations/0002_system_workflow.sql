-- Product-neutral System workflow persistence.
-- Business payloads and organization vocabulary remain in their owning contexts.

CREATE TABLE system_cases (
  id TEXT PRIMARY KEY NOT NULL
    CHECK (length(id) BETWEEN 1 AND 255),
  subject_context TEXT NOT NULL
    CHECK (length(subject_context) BETWEEN 1 AND 100),
  subject_kind TEXT NOT NULL
    CHECK (length(subject_kind) BETWEEN 1 AND 100),
  subject_id TEXT NOT NULL
    CHECK (length(subject_id) BETWEEN 1 AND 512),
  subject_version TEXT NOT NULL
    CHECK (length(subject_version) BETWEEN 1 AND 255),
  proposal_digest TEXT NOT NULL
    CHECK (
      length(proposal_digest) = 64
      AND proposal_digest NOT GLOB '*[^0-9a-f]*'
    ),
  created_by_account_id TEXT NOT NULL
    REFERENCES system_accounts(id) ON DELETE RESTRICT,
  status TEXT NOT NULL
    CHECK (status IN ('pending', 'approved', 'rejected', 'returned', 'cancelled', 'executed')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
    CHECK (updated_at >= created_at)
);

CREATE INDEX system_cases_subject_idx
  ON system_cases (subject_context, subject_kind, subject_id, subject_version);
CREATE INDEX system_cases_creator_idx
  ON system_cases (created_by_account_id, created_at);
CREATE INDEX system_cases_status_idx
  ON system_cases (status, updated_at);

/* DDL-only test harnesses skip compound triggers. Full migration loaders apply this statement. */
CREATE TRIGGER system_cases_monotonic_lifecycle
BEFORE UPDATE ON system_cases
WHEN
  NEW.id IS NOT OLD.id
  OR NEW.subject_context IS NOT OLD.subject_context
  OR NEW.subject_kind IS NOT OLD.subject_kind
  OR NEW.subject_id IS NOT OLD.subject_id
  OR NEW.subject_version IS NOT OLD.subject_version
  OR NEW.proposal_digest IS NOT OLD.proposal_digest
  OR NEW.created_by_account_id IS NOT OLD.created_by_account_id
  OR NEW.created_at IS NOT OLD.created_at
  OR NEW.updated_at < OLD.updated_at
  OR (NEW.status IS OLD.status AND NEW.updated_at IS NOT OLD.updated_at)
  OR (
    NEW.status IS NOT OLD.status
    AND NOT (
      (OLD.status = 'pending' AND NEW.status IN ('approved', 'rejected', 'returned', 'cancelled'))
      OR (OLD.status = 'approved' AND NEW.status = 'executed')
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'system case lifecycle is not monotonic');
END;

/* DDL-only test harnesses skip compound triggers. Full migration loaders apply this statement. */
CREATE TRIGGER system_cases_approved_tasks
BEFORE UPDATE OF status ON system_cases
WHEN NEW.status = 'approved' AND (
  NOT EXISTS (
    SELECT 1 FROM system_decision_tasks
    WHERE case_id = NEW.id
  )
  OR EXISTS (
    SELECT 1 FROM system_decision_tasks
    WHERE case_id = NEW.id AND outcome IS NOT 'approved'
  )
)
BEGIN
  SELECT RAISE(ABORT, 'system case approval requires approved tasks');
END;

/* DDL-only test harnesses skip compound triggers. Full migration loaders apply this statement. */
CREATE TRIGGER system_cases_negative_decision_evidence
BEFORE UPDATE OF status ON system_cases
WHEN NEW.status IN ('rejected', 'returned') AND (
  NOT EXISTS (
    SELECT 1 FROM system_decision_tasks
    WHERE case_id = NEW.id AND outcome = NEW.status
  )
  OR EXISTS (
    SELECT 1 FROM system_decision_tasks
    WHERE case_id = NEW.id AND outcome IS NULL
  )
  OR (
    NEW.status = 'returned'
    AND EXISTS (
      SELECT 1 FROM system_decision_tasks
      WHERE case_id = NEW.id AND outcome = 'rejected'
    )
  )
)
BEGIN
  SELECT RAISE(ABORT, 'system case decision requires matching task evidence');
END;

/* DDL-only test harnesses skip compound triggers. Full migration loaders apply this statement. */
CREATE TRIGGER system_cases_cancelled_tasks
BEFORE UPDATE OF status ON system_cases
WHEN NEW.status = 'cancelled' AND EXISTS (
  SELECT 1 FROM system_decision_tasks
  WHERE case_id = NEW.id AND outcome IS NULL
)
BEGIN
  SELECT RAISE(ABORT, 'system case cancellation requires closed tasks');
END;

/* DDL-only test harnesses skip compound triggers. Full migration loaders apply this statement. */
CREATE TRIGGER system_cases_execution_evidence
BEFORE UPDATE OF status ON system_cases
WHEN NEW.status = 'executed' AND (
  NOT EXISTS (
    SELECT 1 FROM system_execution_authorizations
    WHERE case_id = NEW.id
  )
  OR EXISTS (
    SELECT 1 FROM system_execution_authorizations
    WHERE case_id = NEW.id AND used_at IS NULL
  )
)
BEGIN
  SELECT RAISE(ABORT, 'system case execution requires consumed authorizations');
END;

/* DDL-only test harnesses skip compound triggers. Full migration loaders apply this statement. */
CREATE TRIGGER system_cases_prevent_delete
BEFORE DELETE ON system_cases
BEGIN
  SELECT RAISE(ABORT, 'system case is immutable');
END;

CREATE TABLE system_decision_tasks (
  case_id TEXT NOT NULL
    REFERENCES system_cases(id) ON DELETE RESTRICT,
  task_key TEXT NOT NULL
    CHECK (length(task_key) BETWEEN 1 AND 100),
  round INTEGER NOT NULL
    CHECK (round > 0),
  required_approvals INTEGER NOT NULL
    CHECK (required_approvals BETWEEN 1 AND 100),
  proposal_digest TEXT NOT NULL
    CHECK (
      length(proposal_digest) = 64
      AND proposal_digest NOT GLOB '*[^0-9a-f]*'
    ),
  opened_at INTEGER NOT NULL,
  due_at INTEGER
    CHECK (due_at IS NULL OR due_at >= opened_at),
  outcome TEXT
    CHECK (outcome IS NULL OR outcome IN ('approved', 'rejected', 'returned', 'cancelled')),
  closed_at INTEGER
    CHECK (closed_at IS NULL OR closed_at >= opened_at),
  CHECK (
    (outcome IS NULL AND closed_at IS NULL)
    OR (outcome IS NOT NULL AND closed_at IS NOT NULL)
  ),
  PRIMARY KEY (case_id, task_key, round)
);

CREATE INDEX system_decision_tasks_open_idx
  ON system_decision_tasks (due_at, opened_at)
  WHERE closed_at IS NULL;

/* DDL-only test harnesses skip compound triggers. Full migration loaders apply this statement. */
CREATE TRIGGER system_decision_tasks_valid_insert
BEFORE INSERT ON system_decision_tasks
WHEN
  NOT EXISTS (
    SELECT 1 FROM system_cases
    WHERE
      id = NEW.case_id
      AND status = 'pending'
      AND proposal_digest = NEW.proposal_digest
  )
  OR EXISTS (
    SELECT 1 FROM system_decision_tasks
    WHERE
      case_id = NEW.case_id
      AND task_key = NEW.task_key
      AND outcome IS NULL
  )
  OR (
    NEW.round > 1
    AND NOT EXISTS (
      SELECT 1 FROM system_decision_tasks
      WHERE
        case_id = NEW.case_id
        AND task_key = NEW.task_key
        AND round = NEW.round - 1
        AND outcome = 'cancelled'
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'decision task requires matching pending case');
END;

/* DDL-only test harnesses skip compound triggers. Full migration loaders apply this statement. */
CREATE TRIGGER system_decision_tasks_monotonic_lifecycle
BEFORE UPDATE ON system_decision_tasks
WHEN
  NEW.case_id IS NOT OLD.case_id
  OR NEW.task_key IS NOT OLD.task_key
  OR NEW.round IS NOT OLD.round
  OR NEW.required_approvals IS NOT OLD.required_approvals
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

/* DDL-only test harnesses skip compound triggers. Full migration loaders apply this statement. */
CREATE TRIGGER system_decision_tasks_approved_quorum
BEFORE UPDATE OF outcome ON system_decision_tasks
WHEN NEW.outcome = 'approved' AND (
  EXISTS (
    SELECT 1 FROM system_human_attestations
    WHERE
      case_id = NEW.case_id
      AND task_key = NEW.task_key
      AND round = NEW.round
      AND action IN ('reject', 'return')
  )
  OR (
    SELECT count(*) FROM system_human_attestations
    WHERE
      case_id = NEW.case_id
      AND task_key = NEW.task_key
      AND round = NEW.round
      AND action = 'approve'
  ) < NEW.required_approvals
)
BEGIN
  SELECT RAISE(ABORT, 'decision task approval requires quorum');
END;

/* DDL-only test harnesses skip compound triggers. Full migration loaders apply this statement. */
CREATE TRIGGER system_decision_tasks_negative_evidence
BEFORE UPDATE OF outcome ON system_decision_tasks
WHEN NEW.outcome IN ('rejected', 'returned') AND NOT EXISTS (
  SELECT 1 FROM system_human_attestations
  WHERE
    case_id = NEW.case_id
    AND task_key = NEW.task_key
    AND round = NEW.round
    AND (
      (NEW.outcome = 'rejected' AND action = 'reject')
      OR (NEW.outcome = 'returned' AND action = 'return')
    )
)
BEGIN
  SELECT RAISE(ABORT, 'decision task outcome requires matching attestation');
END;

/* DDL-only test harnesses skip compound triggers. Full migration loaders apply this statement. */
CREATE TRIGGER system_decision_tasks_prevent_delete
BEFORE DELETE ON system_decision_tasks
BEGIN
  SELECT RAISE(ABORT, 'decision task is immutable');
END;

CREATE TABLE system_decision_task_candidates (
  case_id TEXT NOT NULL,
  task_key TEXT NOT NULL,
  round INTEGER NOT NULL,
  candidate_account_id TEXT NOT NULL
    REFERENCES system_accounts(id) ON DELETE RESTRICT,
  source TEXT NOT NULL
    CHECK (source IN ('primary', 'escalation')),
  evidence_context TEXT NOT NULL
    CHECK (length(evidence_context) BETWEEN 1 AND 100),
  evidence_kind TEXT NOT NULL
    CHECK (length(evidence_kind) BETWEEN 1 AND 100),
  evidence_id TEXT NOT NULL
    CHECK (length(evidence_id) BETWEEN 1 AND 512),
  evidence_version TEXT NOT NULL
    CHECK (length(evidence_version) BETWEEN 1 AND 255),
  eligibility_digest TEXT NOT NULL
    CHECK (
      length(eligibility_digest) = 64
      AND eligibility_digest NOT GLOB '*[^0-9a-f]*'
    ),
  eligible_from INTEGER,
  resolved_at INTEGER NOT NULL,
  CHECK (eligible_from IS NULL OR eligible_from >= resolved_at),
  CHECK (
    (source = 'primary' AND eligible_from IS NULL)
    OR (source = 'escalation' AND eligible_from IS NOT NULL)
  ),
  PRIMARY KEY (case_id, task_key, round, candidate_account_id, source),
  FOREIGN KEY (case_id, task_key, round)
    REFERENCES system_decision_tasks(case_id, task_key, round) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX system_decision_task_candidates_account_uniq
  ON system_decision_task_candidates (case_id, task_key, round, candidate_account_id);
CREATE INDEX system_decision_task_candidates_account_idx
  ON system_decision_task_candidates (candidate_account_id, resolved_at);

/* DDL-only test harnesses skip compound triggers. Full migration loaders apply this statement. */
CREATE TRIGGER system_decision_task_candidates_valid_insert
BEFORE INSERT ON system_decision_task_candidates
WHEN
  NOT EXISTS (
    SELECT 1 FROM system_decision_tasks
    WHERE
      case_id = NEW.case_id
      AND task_key = NEW.task_key
      AND round = NEW.round
      AND closed_at IS NULL
  )
  OR EXISTS (
    SELECT 1 FROM system_human_attestations
    WHERE
      case_id = NEW.case_id
      AND task_key = NEW.task_key
      AND round = NEW.round
  )
  OR EXISTS (
    SELECT 1 FROM system_cases
    WHERE id = NEW.case_id AND created_by_account_id = NEW.candidate_account_id
  )
  OR EXISTS (
    SELECT 1 FROM system_decision_task_exclusions
    WHERE
      case_id = NEW.case_id
      AND task_key = NEW.task_key
      AND round = NEW.round
      AND excluded_account_id = NEW.candidate_account_id
  )
BEGIN
  SELECT RAISE(ABORT, 'invalid decision task candidate');
END;

/* DDL-only test harnesses skip compound triggers. Full migration loaders apply this statement. */
CREATE TRIGGER system_decision_task_candidates_prevent_update
BEFORE UPDATE ON system_decision_task_candidates
BEGIN
  SELECT RAISE(ABORT, 'decision task candidate is immutable');
END;

/* DDL-only test harnesses skip compound triggers. Full migration loaders apply this statement. */
CREATE TRIGGER system_decision_task_candidates_prevent_delete
BEFORE DELETE ON system_decision_task_candidates
BEGIN
  SELECT RAISE(ABORT, 'decision task candidate is immutable');
END;

CREATE TABLE system_decision_task_exclusions (
  case_id TEXT NOT NULL,
  task_key TEXT NOT NULL,
  round INTEGER NOT NULL,
  excluded_account_id TEXT NOT NULL
    REFERENCES system_accounts(id) ON DELETE RESTRICT,
  reason TEXT NOT NULL
    CHECK (reason IN ('creator', 'subject', 'policy')),
  PRIMARY KEY (case_id, task_key, round, excluded_account_id),
  FOREIGN KEY (case_id, task_key, round)
    REFERENCES system_decision_tasks(case_id, task_key, round) ON DELETE RESTRICT
);

CREATE INDEX system_decision_task_exclusions_account_idx
  ON system_decision_task_exclusions (excluded_account_id);

/* DDL-only test harnesses skip compound triggers. Full migration loaders apply this statement. */
CREATE TRIGGER system_decision_task_exclusions_valid_insert
BEFORE INSERT ON system_decision_task_exclusions
WHEN
  NOT EXISTS (
    SELECT 1 FROM system_decision_tasks
    WHERE
      case_id = NEW.case_id
      AND task_key = NEW.task_key
      AND round = NEW.round
      AND closed_at IS NULL
  )
  OR EXISTS (
    SELECT 1 FROM system_human_attestations
    WHERE
      case_id = NEW.case_id
      AND task_key = NEW.task_key
      AND round = NEW.round
  )
  OR EXISTS (
    SELECT 1 FROM system_decision_task_candidates
    WHERE
      case_id = NEW.case_id
      AND task_key = NEW.task_key
      AND round = NEW.round
      AND candidate_account_id = NEW.excluded_account_id
  )
  OR (
    NEW.reason = 'creator'
    AND NOT EXISTS (
      SELECT 1 FROM system_cases
      WHERE id = NEW.case_id AND created_by_account_id = NEW.excluded_account_id
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'invalid decision task exclusion');
END;

/* DDL-only test harnesses skip compound triggers. Full migration loaders apply this statement. */
CREATE TRIGGER system_decision_task_exclusions_prevent_update
BEFORE UPDATE ON system_decision_task_exclusions
BEGIN
  SELECT RAISE(ABORT, 'decision task exclusion is immutable');
END;

/* DDL-only test harnesses skip compound triggers. Full migration loaders apply this statement. */
CREATE TRIGGER system_decision_task_exclusions_prevent_delete
BEFORE DELETE ON system_decision_task_exclusions
BEGIN
  SELECT RAISE(ABORT, 'decision task exclusion is immutable');
END;

CREATE TABLE system_delegations (
  id TEXT PRIMARY KEY NOT NULL
    CHECK (length(id) BETWEEN 1 AND 255),
  delegator_account_id TEXT NOT NULL
    REFERENCES system_accounts(id) ON DELETE RESTRICT,
  delegate_account_id TEXT NOT NULL
    REFERENCES system_accounts(id) ON DELETE RESTRICT,
  scope_context TEXT,
  scope_kind TEXT,
  scope_id TEXT,
  scope_version TEXT,
  starts_at INTEGER NOT NULL,
  ends_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  revoked_at INTEGER,
  CHECK (delegator_account_id <> delegate_account_id),
  CHECK (
    (
      scope_context IS NULL
      AND scope_kind IS NULL
      AND scope_id IS NULL
      AND scope_version IS NULL
    )
    OR (
      length(scope_context) BETWEEN 1 AND 100
      AND length(scope_kind) BETWEEN 1 AND 100
      AND length(scope_id) BETWEEN 1 AND 512
      AND length(scope_version) BETWEEN 1 AND 255
    )
  ),
  CHECK (
    ends_at > starts_at
    AND created_at <= starts_at
    AND (
      revoked_at IS NULL
      OR (revoked_at >= created_at AND revoked_at <= ends_at)
    )
  )
);

CREATE INDEX system_delegations_delegator_idx
  ON system_delegations (delegator_account_id, starts_at);
CREATE INDEX system_delegations_delegate_idx
  ON system_delegations (delegate_account_id, starts_at);

/* DDL-only test harnesses skip compound triggers. Full migration loaders apply this statement. */
CREATE TRIGGER system_delegations_monotonic_lifecycle
BEFORE UPDATE ON system_delegations
WHEN
  NEW.id IS NOT OLD.id
  OR NEW.delegator_account_id IS NOT OLD.delegator_account_id
  OR NEW.delegate_account_id IS NOT OLD.delegate_account_id
  OR NEW.scope_context IS NOT OLD.scope_context
  OR NEW.scope_kind IS NOT OLD.scope_kind
  OR NEW.scope_id IS NOT OLD.scope_id
  OR NEW.scope_version IS NOT OLD.scope_version
  OR NEW.starts_at IS NOT OLD.starts_at
  OR NEW.ends_at IS NOT OLD.ends_at
  OR NEW.created_at IS NOT OLD.created_at
  OR OLD.revoked_at IS NOT NULL
  OR NEW.revoked_at IS NULL
BEGIN
  SELECT RAISE(ABORT, 'delegation lifecycle is not monotonic');
END;

/* DDL-only test harnesses skip compound triggers. Full migration loaders apply this statement. */
CREATE TRIGGER system_delegations_prevent_delete
BEFORE DELETE ON system_delegations
BEGIN
  SELECT RAISE(ABORT, 'delegation is immutable');
END;

CREATE TABLE system_human_attestations (
  id TEXT PRIMARY KEY NOT NULL
    CHECK (length(id) BETWEEN 1 AND 255),
  case_id TEXT NOT NULL,
  task_key TEXT NOT NULL,
  round INTEGER NOT NULL,
  actor_account_id TEXT NOT NULL
    REFERENCES system_accounts(id) ON DELETE RESTRICT,
  represented_account_id TEXT NOT NULL
    REFERENCES system_accounts(id) ON DELETE RESTRICT,
  delegation_id TEXT
    REFERENCES system_delegations(id) ON DELETE RESTRICT,
  action TEXT NOT NULL
    CHECK (action IN ('approve', 'reject', 'return')),
  proposal_digest TEXT NOT NULL
    CHECK (
      length(proposal_digest) = 64
      AND proposal_digest NOT GLOB '*[^0-9a-f]*'
    ),
  comment TEXT
    CHECK (comment IS NULL OR length(comment) <= 4000),
  decided_at INTEGER NOT NULL,
  CHECK (
    (actor_account_id = represented_account_id AND delegation_id IS NULL)
    OR (actor_account_id <> represented_account_id AND delegation_id IS NOT NULL)
  ),
  FOREIGN KEY (case_id, task_key, round)
    REFERENCES system_decision_tasks(case_id, task_key, round) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX system_human_attestations_actor_uniq
  ON system_human_attestations (case_id, task_key, round, actor_account_id);
CREATE UNIQUE INDEX system_human_attestations_represented_uniq
  ON system_human_attestations (case_id, task_key, round, represented_account_id);
CREATE INDEX system_human_attestations_decided_idx
  ON system_human_attestations (decided_at);

/* DDL-only test harnesses skip compound triggers. Full migration loaders apply this statement. */
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

/* DDL-only test harnesses skip compound triggers. Full migration loaders apply this statement. */
CREATE TRIGGER system_human_attestations_prevent_update
BEFORE UPDATE ON system_human_attestations
BEGIN
  SELECT RAISE(ABORT, 'human attestation is immutable');
END;

/* DDL-only test harnesses skip compound triggers. Full migration loaders apply this statement. */
CREATE TRIGGER system_human_attestations_prevent_delete
BEFORE DELETE ON system_human_attestations
BEGIN
  SELECT RAISE(ABORT, 'human attestation is immutable');
END;

CREATE TABLE system_execution_authorizations (
  id TEXT PRIMARY KEY NOT NULL
    CHECK (length(id) BETWEEN 1 AND 255),
  case_id TEXT NOT NULL
    REFERENCES system_cases(id) ON DELETE RESTRICT,
  operation_key TEXT NOT NULL
    CHECK (length(operation_key) BETWEEN 1 AND 100),
  proposal_digest TEXT NOT NULL
    CHECK (
      length(proposal_digest) = 64
      AND proposal_digest NOT GLOB '*[^0-9a-f]*'
    ),
  granted_to_account_id TEXT NOT NULL
    REFERENCES system_accounts(id) ON DELETE RESTRICT,
  granted_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at INTEGER,
  CHECK (
    expires_at > granted_at
    AND (
      used_at IS NULL
      OR (used_at >= granted_at AND used_at < expires_at)
    )
  )
);

CREATE UNIQUE INDEX system_execution_authorizations_case_operation_uniq
  ON system_execution_authorizations (case_id, operation_key);
CREATE INDEX system_execution_authorizations_grantee_idx
  ON system_execution_authorizations (granted_to_account_id, granted_at);

/* DDL-only test harnesses skip compound triggers. Full migration loaders apply this statement. */
CREATE TRIGGER system_execution_authorizations_valid_insert
BEFORE INSERT ON system_execution_authorizations
WHEN NOT EXISTS (
  SELECT 1 FROM system_cases
  WHERE
    id = NEW.case_id
    AND status = 'approved'
    AND proposal_digest = NEW.proposal_digest
)
BEGIN
  SELECT RAISE(ABORT, 'execution authorization requires approved case');
END;

/* DDL-only test harnesses skip compound triggers. Full migration loaders apply this statement. */
CREATE TRIGGER system_execution_authorizations_single_use
BEFORE UPDATE ON system_execution_authorizations
WHEN
  NEW.id IS NOT OLD.id
  OR NEW.case_id IS NOT OLD.case_id
  OR NEW.operation_key IS NOT OLD.operation_key
  OR NEW.proposal_digest IS NOT OLD.proposal_digest
  OR NEW.granted_to_account_id IS NOT OLD.granted_to_account_id
  OR NEW.granted_at IS NOT OLD.granted_at
  OR NEW.expires_at IS NOT OLD.expires_at
  OR OLD.used_at IS NOT NULL
  OR NEW.used_at IS NULL
  OR NOT EXISTS (
    SELECT 1 FROM system_cases
    WHERE
      id = NEW.case_id
      AND status = 'approved'
      AND proposal_digest = NEW.proposal_digest
  )
BEGIN
  SELECT RAISE(ABORT, 'execution authorization is single use');
END;

/* DDL-only test harnesses skip compound triggers. Full migration loaders apply this statement. */
CREATE TRIGGER system_execution_authorizations_prevent_delete
BEFORE DELETE ON system_execution_authorizations
BEGIN
  SELECT RAISE(ABORT, 'execution authorization is immutable');
END;
