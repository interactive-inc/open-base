-- Product-neutral versioned procedures and immutable proposal bodies.

CREATE TABLE system_procedure_definitions (
  key TEXT PRIMARY KEY NOT NULL
    CHECK (
      length(key) BETWEEN 1 AND 100
      AND key NOT GLOB '*[^a-z0-9_-]*'
      AND substr(key, 1, 1) GLOB '[a-z]'
    ),
  current_revision INTEGER NOT NULL CHECK (current_revision > 0),
  status TEXT NOT NULL CHECK (status IN ('active', 'retired')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL CHECK (updated_at >= created_at)
);

CREATE INDEX system_procedure_definitions_status_idx
  ON system_procedure_definitions (status, updated_at);

/* DDL-only test harnesses skip compound triggers. Full migration loaders apply this statement. */
CREATE TRIGGER system_procedure_definitions_monotonic_lifecycle
BEFORE UPDATE ON system_procedure_definitions
WHEN
  NEW.key IS NOT OLD.key
  OR NEW.created_at IS NOT OLD.created_at
  OR NEW.updated_at < OLD.updated_at
  OR NEW.current_revision NOT IN (OLD.current_revision, OLD.current_revision + 1)
  OR (OLD.status = 'retired' AND NEW.status IS NOT OLD.status)
  OR (
    NEW.current_revision IS OLD.current_revision
    AND NEW.status IS OLD.status
    AND NEW.updated_at IS NOT OLD.updated_at
  )
  OR (
    NEW.current_revision = OLD.current_revision + 1
    AND NOT EXISTS (
      SELECT 1 FROM system_procedure_definition_revisions
      WHERE procedure_key = OLD.key AND revision = NEW.current_revision
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'system procedure lifecycle is not monotonic');
END;

/* DDL-only test harnesses skip compound triggers. Full migration loaders apply this statement. */
CREATE TRIGGER system_procedure_definitions_prevent_delete
BEFORE DELETE ON system_procedure_definitions
BEGIN
  SELECT RAISE(ABORT, 'system procedure is immutable');
END;

CREATE TABLE system_procedure_numbers (
  number INTEGER PRIMARY KEY AUTOINCREMENT,
  procedure_key TEXT NOT NULL
    REFERENCES system_procedure_definitions(key) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX system_procedure_numbers_key_uniq
  ON system_procedure_numbers (procedure_key);

/* DDL-only test harnesses skip compound triggers. Full migration loaders apply this statement. */
CREATE TRIGGER system_procedure_numbers_prevent_update
BEFORE UPDATE ON system_procedure_numbers
BEGIN
  SELECT RAISE(ABORT, 'system procedure number is immutable');
END;

/* DDL-only test harnesses skip compound triggers. Full migration loaders apply this statement. */
CREATE TRIGGER system_procedure_numbers_prevent_delete
BEFORE DELETE ON system_procedure_numbers
BEGIN
  SELECT RAISE(ABORT, 'system procedure number is immutable');
END;

CREATE TABLE system_procedure_definition_revisions (
  procedure_key TEXT NOT NULL
    REFERENCES system_procedure_definitions(key) ON DELETE RESTRICT,
  revision INTEGER NOT NULL CHECK (revision > 0),
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 500),
  category TEXT NOT NULL CHECK (length(category) BETWEEN 1 AND 200),
  description TEXT CHECK (description IS NULL OR length(description) <= 3000),
  input_schema_json TEXT NOT NULL
    CHECK (json_valid(input_schema_json) AND length(input_schema_json) BETWEEN 1 AND 1000000),
  decision_policy_json TEXT NOT NULL
    CHECK (json_valid(decision_policy_json) AND length(decision_policy_json) BETWEEN 1 AND 1000000),
  completion_operation_key TEXT
    CHECK (completion_operation_key IS NULL OR length(completion_operation_key) BETWEEN 1 AND 100),
  created_by_account_id TEXT NOT NULL
    REFERENCES system_accounts(id) ON DELETE RESTRICT,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (procedure_key, revision)
);

CREATE INDEX system_procedure_definition_revisions_creator_idx
  ON system_procedure_definition_revisions (created_by_account_id, created_at);

/* DDL-only test harnesses skip compound triggers. Full migration loaders apply this statement. */
CREATE TRIGGER system_procedure_definition_revisions_valid_insert
BEFORE INSERT ON system_procedure_definition_revisions
WHEN NOT EXISTS (
  SELECT 1 FROM system_procedure_definitions
  WHERE key = NEW.procedure_key
    AND NEW.revision IN (current_revision, current_revision + 1)
)
BEGIN
  SELECT RAISE(ABORT, 'invalid system procedure revision');
END;

/* DDL-only test harnesses skip compound triggers. Full migration loaders apply this statement. */
CREATE TRIGGER system_procedure_definition_revisions_prevent_update
BEFORE UPDATE ON system_procedure_definition_revisions
BEGIN
  SELECT RAISE(ABORT, 'system procedure revision is immutable');
END;

/* DDL-only test harnesses skip compound triggers. Full migration loaders apply this statement. */
CREATE TRIGGER system_procedure_definition_revisions_prevent_delete
BEFORE DELETE ON system_procedure_definition_revisions
BEGIN
  SELECT RAISE(ABORT, 'system procedure revision is immutable');
END;

CREATE TABLE system_proposal_series (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) BETWEEN 1 AND 255),
  procedure_key TEXT NOT NULL
    REFERENCES system_procedure_definitions(key) ON DELETE RESTRICT,
  created_by_account_id TEXT NOT NULL
    REFERENCES system_accounts(id) ON DELETE RESTRICT,
  created_at INTEGER NOT NULL
);

CREATE INDEX system_proposal_series_definition_idx
  ON system_proposal_series (procedure_key, created_at);
CREATE INDEX system_proposal_series_creator_idx
  ON system_proposal_series (created_by_account_id, created_at);

/* DDL-only test harnesses skip compound triggers. Full migration loaders apply this statement. */
CREATE TRIGGER system_proposal_series_prevent_update
BEFORE UPDATE ON system_proposal_series
BEGIN
  SELECT RAISE(ABORT, 'system proposal series is immutable');
END;

/* DDL-only test harnesses skip compound triggers. Full migration loaders apply this statement. */
CREATE TRIGGER system_proposal_series_prevent_delete
BEFORE DELETE ON system_proposal_series
BEGIN
  SELECT RAISE(ABORT, 'system proposal series is immutable');
END;

CREATE TABLE system_proposals (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) BETWEEN 1 AND 255),
  series_id TEXT NOT NULL
    REFERENCES system_proposal_series(id) ON DELETE RESTRICT,
  version INTEGER NOT NULL CHECK (version > 0),
  procedure_key TEXT NOT NULL,
  procedure_revision INTEGER NOT NULL,
  body_json TEXT NOT NULL
    CHECK (json_valid(body_json) AND length(body_json) BETWEEN 1 AND 1000000),
  digest TEXT NOT NULL
    CHECK (length(digest) = 64 AND digest NOT GLOB '*[^0-9a-f]*'),
  created_by_account_id TEXT NOT NULL
    REFERENCES system_accounts(id) ON DELETE RESTRICT,
  supersedes_proposal_id TEXT
    REFERENCES system_proposals(id) ON DELETE RESTRICT,
  created_at INTEGER NOT NULL,
  CHECK (
    (version = 1 AND supersedes_proposal_id IS NULL)
    OR (version > 1 AND supersedes_proposal_id IS NOT NULL)
  ),
  FOREIGN KEY (procedure_key, procedure_revision)
    REFERENCES system_procedure_definition_revisions(procedure_key, revision) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX system_proposals_series_version_uniq
  ON system_proposals (series_id, version);
CREATE INDEX system_proposals_definition_idx
  ON system_proposals (procedure_key, procedure_revision);
CREATE INDEX system_proposals_creator_idx
  ON system_proposals (created_by_account_id, created_at);

/* DDL-only test harnesses skip compound triggers. Full migration loaders apply this statement. */
CREATE TRIGGER system_proposals_valid_insert
BEFORE INSERT ON system_proposals
WHEN
  NOT EXISTS (
    SELECT 1 FROM system_procedure_definitions
    WHERE key = NEW.procedure_key
      AND status = 'active'
      AND current_revision = NEW.procedure_revision
  )
  OR NOT EXISTS (
    SELECT 1 FROM system_proposal_series AS series
    WHERE series.id = NEW.series_id
      AND series.procedure_key = NEW.procedure_key
      AND series.created_by_account_id = NEW.created_by_account_id
      AND series.created_at <= NEW.created_at
  )
  OR (
    NEW.version > 1
    AND NOT EXISTS (
      SELECT 1 FROM system_proposals AS previous
      WHERE previous.id = NEW.supersedes_proposal_id
        AND previous.series_id = NEW.series_id
        AND previous.version = NEW.version - 1
        AND previous.procedure_key = NEW.procedure_key
        AND previous.created_by_account_id = NEW.created_by_account_id
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'invalid system proposal');
END;

/* DDL-only test harnesses skip compound triggers. Full migration loaders apply this statement. */
CREATE TRIGGER system_proposals_prevent_update
BEFORE UPDATE ON system_proposals
BEGIN
  SELECT RAISE(ABORT, 'system proposal is immutable');
END;

/* DDL-only test harnesses skip compound triggers. Full migration loaders apply this statement. */
CREATE TRIGGER system_proposals_prevent_delete
BEFORE DELETE ON system_proposals
BEGIN
  SELECT RAISE(ABORT, 'system proposal is immutable');
END;

CREATE TABLE system_proposal_numbers (
  number INTEGER PRIMARY KEY AUTOINCREMENT,
  series_id TEXT NOT NULL
    REFERENCES system_proposal_series(id) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX system_proposal_numbers_series_uniq
  ON system_proposal_numbers (series_id);

/* DDL-only test harnesses skip compound triggers. Full migration loaders apply this statement. */
CREATE TRIGGER system_proposal_numbers_prevent_update
BEFORE UPDATE ON system_proposal_numbers
BEGIN
  SELECT RAISE(ABORT, 'system proposal number is immutable');
END;

/* DDL-only test harnesses skip compound triggers. Full migration loaders apply this statement. */
CREATE TRIGGER system_proposal_numbers_prevent_delete
BEFORE DELETE ON system_proposal_numbers
BEGIN
  SELECT RAISE(ABORT, 'system proposal number is immutable');
END;

CREATE TABLE system_proposal_cases (
  proposal_id TEXT PRIMARY KEY NOT NULL
    REFERENCES system_proposals(id) ON DELETE RESTRICT,
  case_id TEXT NOT NULL
    REFERENCES system_cases(id) ON DELETE RESTRICT,
  linked_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX system_proposal_cases_case_uniq
  ON system_proposal_cases (case_id);

/* DDL-only test harnesses skip compound triggers. Full migration loaders apply this statement. */
CREATE TRIGGER system_proposal_cases_valid_insert
BEFORE INSERT ON system_proposal_cases
WHEN NOT EXISTS (
  SELECT 1
  FROM system_proposals AS proposal
  JOIN system_cases AS workflow_case ON workflow_case.id = NEW.case_id
  WHERE proposal.id = NEW.proposal_id
    AND (
      workflow_case.subject_context <> 'system'
      OR (
        workflow_case.subject_kind = 'proposal'
        AND workflow_case.subject_id = proposal.series_id
        AND workflow_case.subject_version = CAST(proposal.version AS TEXT)
      )
    )
    AND workflow_case.proposal_digest = proposal.digest
    AND workflow_case.created_by_account_id = proposal.created_by_account_id
    AND workflow_case.created_at = NEW.linked_at
)
BEGIN
  SELECT RAISE(ABORT, 'system proposal case does not match');
END;

/* DDL-only test harnesses skip compound triggers. Full migration loaders apply this statement. */
CREATE TRIGGER system_proposal_cases_prevent_update
BEFORE UPDATE ON system_proposal_cases
BEGIN
  SELECT RAISE(ABORT, 'system proposal case is immutable');
END;

/* DDL-only test harnesses skip compound triggers. Full migration loaders apply this statement. */
CREATE TRIGGER system_proposal_cases_prevent_delete
BEFORE DELETE ON system_proposal_cases
BEGIN
  SELECT RAISE(ABORT, 'system proposal case is immutable');
END;
