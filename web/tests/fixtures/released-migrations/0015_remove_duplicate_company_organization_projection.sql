-- 所属・責務の二重保存を廃止し、canonical Company organization期間だけを正本にする。

CREATE TABLE _company_organization_projection_cutover_validation (
  resource TEXT PRIMARY KEY NOT NULL,
  source_count INTEGER NOT NULL,
  target_count INTEGER NOT NULL,
  missing_count INTEGER NOT NULL,
  CHECK (source_count = target_count AND missing_count = 0)
);

INSERT INTO _company_organization_projection_cutover_validation
SELECT
  'assignments',
  (SELECT count(*) FROM company_employee_org_assignment_period_versions),
  (
    SELECT count(*)
    FROM company_employee_org_assignment_period_versions source
    INNER JOIN company_organization_assignment_period_versions target
      ON target.period_id = 'assignment-period:' || source.period_id
     AND target.revision = source.revision
     AND target.employment_id = 'employment:' || source.employment_period_id
     AND target.employee_id = 'employee:' || source.employee_id
     AND target.organization_unit_id = 'department:' || source.department_code
     AND target.assignment_type = upper(source.assignment_type)
  ),
  (
    SELECT count(*)
    FROM company_employee_org_assignment_period_versions source
    LEFT JOIN company_organization_assignment_period_versions target
      ON target.period_id = 'assignment-period:' || source.period_id
     AND target.revision = source.revision
     AND target.employment_id = 'employment:' || source.employment_period_id
     AND target.employee_id = 'employee:' || source.employee_id
     AND target.organization_unit_id = 'department:' || source.department_code
    WHERE target.period_id IS NULL
  );

INSERT INTO _company_organization_projection_cutover_validation
SELECT
  'employment-periods',
  (SELECT count(*) FROM company_employment_period_versions),
  (
    SELECT count(*)
    FROM company_employment_period_versions period
    INNER JOIN company_employments employment
      ON employment.id = 'employment:' || period.period_id
     AND employment.employee_id = CAST(period.employee_id AS TEXT)
  ),
  (
    SELECT count(*)
    FROM company_employment_period_versions period
    LEFT JOIN company_employments employment
      ON employment.id = 'employment:' || period.period_id
     AND employment.employee_id = CAST(period.employee_id AS TEXT)
    WHERE employment.id IS NULL
  );

INSERT INTO _company_organization_projection_cutover_validation
SELECT
  'responsibilities',
  (SELECT count(*) FROM company_employee_org_responsibility_period_versions),
  (
    SELECT count(*)
    FROM company_employee_org_responsibility_period_versions source
    INNER JOIN company_organization_responsibility_period_versions target
      ON target.period_id = 'responsibility-period:' || source.period_id
     AND target.revision = source.revision
     AND target.employee_id = 'employee:' || source.employee_id
     AND target.organization_unit_id = 'department:' || source.department_code
     AND target.responsibility_type = 'MANAGER'
  ),
  (
    SELECT count(*)
    FROM company_employee_org_responsibility_period_versions source
    LEFT JOIN company_organization_responsibility_period_versions target
      ON target.period_id = 'responsibility-period:' || source.period_id
     AND target.revision = source.revision
     AND target.employee_id = 'employee:' || source.employee_id
     AND target.organization_unit_id = 'department:' || source.department_code
     AND target.responsibility_type = 'MANAGER'
    WHERE target.period_id IS NULL
  );

INSERT INTO _company_organization_projection_cutover_validation
SELECT
  'departments',
  (SELECT count(*) FROM company_org_departments),
  (
    SELECT count(*)
    FROM company_org_departments source
    INNER JOIN company_departments department ON department.id = source.department_id
    INNER JOIN company_organization_unit_period_versions target
      ON target.organization_unit_id = 'department:' || source.code
     AND target.code = source.code
     AND target.official_name = department.name
     AND target.kind = 'DEPARTMENT'
  ),
  (
    SELECT count(*)
    FROM company_org_departments source
    INNER JOIN company_departments department ON department.id = source.department_id
    LEFT JOIN company_organization_unit_period_versions target
      ON target.organization_unit_id = 'department:' || source.code
     AND target.code = source.code
     AND target.official_name = department.name
     AND target.kind = 'DEPARTMENT'
    WHERE target.period_id IS NULL
  );

CREATE TABLE __new_expense_budgets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_unit_id TEXT NOT NULL
    REFERENCES company_organization_units(id) ON DELETE RESTRICT,
  fiscal_period TEXT NOT NULL,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  amount INTEGER NOT NULL,
  name TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL
);

INSERT INTO __new_expense_budgets (
  id, organization_unit_id, fiscal_period, period_start, period_end,
  amount, name, note, created_at
)
SELECT
  budget.id,
  'department:' || department.code,
  budget.fiscal_period,
  budget.period_start,
  budget.period_end,
  budget.amount,
  budget.name,
  budget.note,
  budget.created_at
FROM expense_budgets budget
INNER JOIN company_org_departments department
  ON department.department_id = budget.department_id;

INSERT INTO _company_organization_projection_cutover_validation
SELECT
  'expense-budgets',
  (SELECT count(*) FROM expense_budgets),
  (SELECT count(*) FROM __new_expense_budgets),
  (
    SELECT count(*)
    FROM __new_expense_budgets budget
    LEFT JOIN company_organization_units unit
      ON unit.id = budget.organization_unit_id
    WHERE unit.id IS NULL
  );

DROP TABLE expense_budgets;
ALTER TABLE __new_expense_budgets RENAME TO expense_budgets;
CREATE INDEX idx_expense_budgets_organization_unit
  ON expense_budgets(organization_unit_id);
CREATE INDEX idx_expense_budgets_fiscal_period
  ON expense_budgets(fiscal_period);

DROP TRIGGER IF EXISTS employee_org_assignment_operation_guard;
DROP TRIGGER IF EXISTS employee_org_assignment_operation_state;
DROP TRIGGER IF EXISTS employee_org_assignment_period_versions_immutable_delete;
DROP TRIGGER IF EXISTS employee_org_assignment_period_versions_immutable_update;
DROP TRIGGER IF EXISTS employee_org_responsibility_operation_guard;
DROP TRIGGER IF EXISTS employee_org_responsibility_operation_state;
DROP TRIGGER IF EXISTS employee_org_responsibility_period_versions_immutable_delete;
DROP TRIGGER IF EXISTS employee_org_responsibility_period_versions_immutable_update;

DROP TRIGGER IF EXISTS organization_assignment_period_versions_guard;
DROP TRIGGER IF EXISTS organization_assignment_period_versions_immutable_delete;
DROP TRIGGER IF EXISTS organization_assignment_period_versions_immutable_update;
DROP TRIGGER IF EXISTS organization_assignment_period_versions_revision_state;
DROP TRIGGER IF EXISTS organization_responsibility_period_versions_guard;
DROP TRIGGER IF EXISTS organization_responsibility_period_versions_immutable_delete;
DROP TRIGGER IF EXISTS organization_responsibility_period_versions_immutable_update;
DROP TRIGGER IF EXISTS organization_responsibility_period_versions_revision_state;
DROP TRIGGER IF EXISTS organization_change_operations_completion_guard;
DROP TRIGGER IF EXISTS organization_change_operations_command_immutable;
DROP TRIGGER IF EXISTS organization_change_operations_completed_count_immutable;
DROP TRIGGER IF EXISTS organization_change_operations_immutable;
DROP TRIGGER IF EXISTS organization_change_operations_immutable_delete;
DROP TRIGGER IF EXISTS organization_change_operations_insert_guard;
DROP TRIGGER IF EXISTS organization_unit_period_versions_immutable_delete;
DROP TRIGGER IF EXISTS organization_unit_period_versions_immutable_update;
DROP TRIGGER IF EXISTS organization_unit_period_versions_revision_guard;
DROP TRIGGER IF EXISTS organization_unit_period_versions_revision_state;
DROP TRIGGER IF EXISTS organization_units_immutable_delete;
DROP TRIGGER IF EXISTS organization_units_immutable_update;
DROP TRIGGER IF EXISTS employee_status_period_versions_no_delete;
DROP TRIGGER IF EXISTS employee_status_period_versions_no_update;
DROP TRIGGER IF EXISTS employment_period_versions_no_delete;
DROP TRIGGER IF EXISTS employment_period_versions_no_update;
DROP TRIGGER IF EXISTS audit_event_employee_contexts_prevent_delete;
DROP TRIGGER IF EXISTS audit_event_employee_contexts_prevent_update;
DROP TRIGGER IF EXISTS audit_event_employee_contexts_validate_insert;
DROP TRIGGER IF EXISTS audit_events_append_guard_prevent_delete;
DROP TRIGGER IF EXISTS audit_events_append_guard_prevent_insert;
DROP TRIGGER IF EXISTS audit_events_append_guard_prevent_update;
DROP TRIGGER IF EXISTS audit_events_prevent_delete;
DROP TRIGGER IF EXISTS audit_events_prevent_update;
DROP TRIGGER IF EXISTS audit_events_register_insert;
DROP TRIGGER IF EXISTS company_audit_event_appends_dispatch;
DROP TRIGGER IF EXISTS personnel_action_requests_immutable_proposal;
DROP TRIGGER IF EXISTS personnel_action_requests_system_proposal_insert;
DROP TRIGGER IF EXISTS personnel_actions_no_delete;
DROP TRIGGER IF EXISTS personnel_actions_no_update;

DROP TABLE company_employee_org_responsibility_period_versions;
DROP TABLE company_employee_org_assignment_period_versions;
DROP TABLE company_org_memberships;
DROP TABLE company_org_departments;
DROP TABLE company_departments;

CREATE TABLE _company_schema_rebuild_validation (
  resource TEXT PRIMARY KEY NOT NULL,
  source_count INTEGER NOT NULL,
  staged_count INTEGER NOT NULL,
  CHECK (source_count = staged_count)
);

DROP VIEW company_audit_event_details;

CREATE TABLE __new_company_audit_event_employee_contexts (
  audit_event_id INTEGER PRIMARY KEY,
  employee_id TEXT NOT NULL
);
INSERT INTO __new_company_audit_event_employee_contexts (audit_event_id, employee_id)
SELECT audit_event_id, CAST(employee_id AS TEXT)
FROM company_audit_event_employee_contexts;
INSERT INTO _company_schema_rebuild_validation
VALUES (
  'audit-event-employee-contexts',
  (SELECT count(*) FROM company_audit_event_employee_contexts),
  (SELECT count(*) FROM __new_company_audit_event_employee_contexts)
);
DROP TABLE company_audit_event_employee_contexts;
ALTER TABLE __new_company_audit_event_employee_contexts
  RENAME TO company_audit_event_employee_contexts;

CREATE VIEW company_audit_event_details AS
SELECT
  event.id,
  event.event_id,
  event.request_id,
  event.actor_account_id,
  employee_context.employee_id AS actor_employee_id,
  event.action,
  event.target_type,
  event.target_id,
  event.outcome,
  event.reason_code,
  event.authorization_json,
  event.before_json,
  event.after_json,
  event.metadata_json,
  event.client_ip,
  event.client_name,
  event.created_at
FROM company_audit_events event
LEFT JOIN company_audit_event_employee_contexts employee_context
  ON employee_context.audit_event_id = event.id;

CREATE TABLE __new_company_audit_event_appends (
  staging_id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id TEXT NOT NULL,
  request_id TEXT NOT NULL,
  actor_account_id TEXT,
  actor_employee_id TEXT,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  outcome TEXT NOT NULL,
  reason_code TEXT,
  authorization_json TEXT,
  before_json TEXT,
  after_json TEXT,
  metadata_json TEXT,
  client_ip TEXT,
  client_name TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  CHECK (actor_account_id IS NULL OR length(actor_account_id) BETWEEN 1 AND 255)
);
INSERT INTO __new_company_audit_event_appends (
  staging_id, event_id, request_id, actor_account_id, actor_employee_id, action,
  target_type, target_id, outcome, reason_code, authorization_json, before_json,
  after_json, metadata_json, client_ip, client_name, created_at
)
SELECT
  staging_id, event_id, request_id, actor_account_id, CAST(actor_employee_id AS TEXT), action,
  target_type, target_id, outcome, reason_code, authorization_json, before_json,
  after_json, metadata_json, client_ip, client_name, created_at
FROM company_audit_event_appends;
INSERT INTO _company_schema_rebuild_validation
VALUES (
  'audit-event-appends',
  (SELECT count(*) FROM company_audit_event_appends),
  (SELECT count(*) FROM __new_company_audit_event_appends)
);
DROP TABLE company_audit_event_appends;
ALTER TABLE __new_company_audit_event_appends RENAME TO company_audit_event_appends;

CREATE TABLE __new_company_employee_events (
  id INTEGER PRIMARY KEY,
  employee_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  effective_date TEXT NOT NULL,
  from_department_code TEXT,
  to_department_code TEXT,
  note TEXT,
  created_at TEXT NOT NULL
);
INSERT INTO __new_company_employee_events
SELECT
  id, CAST(employee_id AS TEXT), kind, effective_date,
  from_department_code, to_department_code, note, created_at
FROM company_employee_events;
INSERT INTO _company_schema_rebuild_validation
VALUES (
  'employee-events',
  (SELECT count(*) FROM company_employee_events),
  (SELECT count(*) FROM __new_company_employee_events)
);
DROP TABLE company_employee_events;
ALTER TABLE __new_company_employee_events RENAME TO company_employee_events;

CREATE TABLE __new_company_employee_grades (
  id INTEGER PRIMARY KEY,
  employee_id TEXT NOT NULL,
  grade_id INTEGER NOT NULL,
  effective_date TEXT NOT NULL,
  reason TEXT,
  created_at TEXT NOT NULL
);
INSERT INTO __new_company_employee_grades
SELECT id, CAST(employee_id AS TEXT), grade_id, effective_date, reason, created_at
FROM company_employee_grades;
INSERT INTO _company_schema_rebuild_validation
VALUES (
  'employee-grades',
  (SELECT count(*) FROM company_employee_grades),
  (SELECT count(*) FROM __new_company_employee_grades)
);
DROP TABLE company_employee_grades;
ALTER TABLE __new_company_employee_grades RENAME TO company_employee_grades;

CREATE TABLE __new_company_employee_lifecycle_revisions (
  employee_id TEXT PRIMARY KEY,
  revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  updated_at INTEGER NOT NULL
);
INSERT INTO __new_company_employee_lifecycle_revisions
SELECT CAST(employee_id AS TEXT), revision, updated_at
FROM company_employee_lifecycle_revisions;
INSERT INTO _company_schema_rebuild_validation
VALUES (
  'employee-lifecycle-revisions',
  (SELECT count(*) FROM company_employee_lifecycle_revisions),
  (SELECT count(*) FROM __new_company_employee_lifecycle_revisions)
);
DROP TABLE company_employee_lifecycle_revisions;
ALTER TABLE __new_company_employee_lifecycle_revisions
  RENAME TO company_employee_lifecycle_revisions;

CREATE TABLE __new_company_employment_period_versions (
  period_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision > 0),
  employee_id TEXT NOT NULL,
  starts_on TEXT NOT NULL CHECK (
    length(starts_on) = 10 AND substr(starts_on, 5, 1) = '-' AND substr(starts_on, 8, 1) = '-'
  ),
  ends_on TEXT CHECK (
    ends_on IS NULL OR (
      length(ends_on) = 10 AND substr(ends_on, 5, 1) = '-' AND substr(ends_on, 8, 1) = '-'
    )
  ),
  is_void INTEGER NOT NULL DEFAULT 0 CHECK (is_void IN (0, 1)),
  recorded_by_action_id TEXT NOT NULL,
  recorded_at INTEGER NOT NULL,
  PRIMARY KEY (period_id, revision),
  CHECK (ends_on IS NULL OR starts_on < ends_on)
) WITHOUT ROWID;
INSERT INTO __new_company_employment_period_versions
SELECT
  period_id, revision, CAST(employee_id AS TEXT), starts_on, ends_on,
  is_void, recorded_by_action_id, recorded_at
FROM company_employment_period_versions;
INSERT INTO _company_schema_rebuild_validation
VALUES (
  'employment-period-versions',
  (SELECT count(*) FROM company_employment_period_versions),
  (SELECT count(*) FROM __new_company_employment_period_versions)
);
DROP TABLE company_employment_period_versions;
ALTER TABLE __new_company_employment_period_versions
  RENAME TO company_employment_period_versions;

CREATE TABLE __new_company_employee_status_period_versions (
  period_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision > 0),
  employment_period_id TEXT NOT NULL,
  employee_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'leave')),
  starts_on TEXT NOT NULL CHECK (
    length(starts_on) = 10 AND substr(starts_on, 5, 1) = '-' AND substr(starts_on, 8, 1) = '-'
  ),
  ends_on TEXT CHECK (
    ends_on IS NULL OR (
      length(ends_on) = 10 AND substr(ends_on, 5, 1) = '-' AND substr(ends_on, 8, 1) = '-'
    )
  ),
  is_void INTEGER NOT NULL DEFAULT 0 CHECK (is_void IN (0, 1)),
  recorded_by_action_id TEXT NOT NULL,
  recorded_at INTEGER NOT NULL,
  PRIMARY KEY (period_id, revision),
  CHECK (ends_on IS NULL OR starts_on < ends_on)
) WITHOUT ROWID;
INSERT INTO __new_company_employee_status_period_versions
SELECT
  period_id, revision, employment_period_id, CAST(employee_id AS TEXT), status,
  starts_on, ends_on, is_void, recorded_by_action_id, recorded_at
FROM company_employee_status_period_versions;
INSERT INTO _company_schema_rebuild_validation
VALUES (
  'employee-status-period-versions',
  (SELECT count(*) FROM company_employee_status_period_versions),
  (SELECT count(*) FROM __new_company_employee_status_period_versions)
);
DROP TABLE company_employee_status_period_versions;
ALTER TABLE __new_company_employee_status_period_versions
  RENAME TO company_employee_status_period_versions;

CREATE TABLE __new_company_personnel_action_requests (
  id TEXT PRIMARY KEY,
  application_id INTEGER NOT NULL UNIQUE,
  target_employee_id TEXT,
  kind TEXT NOT NULL CHECK (kind IN (
    'hire', 'rehire', 'primary_assignment_started', 'transferred',
    'concurrent_assignment_started', 'assignment_ended', 'position_changed',
    'manager_changed', 'department_responsibility_started',
    'department_responsibility_ended', 'leave_started', 'returned', 'retired', 'corrected'
  )),
  payload_json TEXT NOT NULL CHECK (json_valid(payload_json)),
  requested_by_employee_id TEXT NOT NULL,
  base_employee_revision INTEGER CHECK (
    base_employee_revision IS NULL OR base_employee_revision >= 0
  ),
  base_organization_revision INTEGER CHECK (
    base_organization_revision IS NULL OR base_organization_revision >= 0
  ),
  created_at INTEGER NOT NULL,
  applied_action_id TEXT,
  withdrawn_at INTEGER,
  withdrawn_by_employee_id TEXT,
  system_proposal_series_id TEXT UNIQUE,
  subject_snapshot_json TEXT CHECK (
    subject_snapshot_json IS NULL OR json_valid(subject_snapshot_json)
  ),
  target_department_code TEXT,
  payload_fingerprint TEXT CHECK (
    payload_fingerprint IS NULL OR length(payload_fingerprint) = 64
  )
);
INSERT INTO __new_company_personnel_action_requests (
  id, application_id, target_employee_id, kind, payload_json, requested_by_employee_id,
  base_employee_revision, base_organization_revision, created_at, applied_action_id,
  withdrawn_at, withdrawn_by_employee_id, system_proposal_series_id,
  subject_snapshot_json, target_department_code, payload_fingerprint
)
SELECT
  id, application_id, CAST(target_employee_id AS TEXT), kind, payload_json,
  CAST(requested_by_employee_id AS TEXT), base_employee_revision, base_organization_revision,
  created_at, applied_action_id, withdrawn_at, CAST(withdrawn_by_employee_id AS TEXT),
  system_proposal_series_id, subject_snapshot_json, target_department_code, payload_fingerprint
FROM company_personnel_action_requests;
INSERT INTO _company_schema_rebuild_validation
VALUES (
  'personnel-action-requests',
  (SELECT count(*) FROM company_personnel_action_requests),
  (SELECT count(*) FROM __new_company_personnel_action_requests)
);
DROP TABLE company_personnel_action_requests;
ALTER TABLE __new_company_personnel_action_requests RENAME TO company_personnel_action_requests;

CREATE TABLE __new_company_personnel_actions (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN (
    'hire', 'rehire', 'primary_assignment_started', 'transferred',
    'concurrent_assignment_started', 'assignment_ended', 'position_changed',
    'manager_changed', 'department_responsibility_started',
    'department_responsibility_ended', 'leave_started', 'returned', 'retired',
    'corrected', 'initial_state'
  )),
  event_on TEXT NOT NULL CHECK (
    length(event_on) = 10 AND substr(event_on, 5, 1) = '-' AND substr(event_on, 8, 1) = '-'
  ),
  recorded_at INTEGER NOT NULL,
  recorded_by_account_id TEXT,
  requested_by_employee_id TEXT,
  source_type TEXT NOT NULL CHECK (source_type IN ('application', 'direct', 'system')),
  source_application_id INTEGER,
  corrects_action_id TEXT,
  operation_id TEXT NOT NULL UNIQUE CHECK (length(operation_id) BETWEEN 1 AND 200),
  payload_fingerprint TEXT NOT NULL CHECK (length(payload_fingerprint) = 64),
  summary_json TEXT NOT NULL CHECK (json_valid(summary_json)),
  CHECK (
    (source_type = 'application' AND source_application_id IS NOT NULL)
    OR (source_type != 'application' AND source_application_id IS NULL)
  ),
  CHECK (corrects_action_id IS NULL OR corrects_action_id != id),
  CHECK (recorded_by_account_id IS NULL OR length(recorded_by_account_id) BETWEEN 1 AND 255)
);
INSERT INTO __new_company_personnel_actions (
  id, employee_id, kind, event_on, recorded_at, recorded_by_account_id,
  requested_by_employee_id, source_type, source_application_id, corrects_action_id,
  operation_id, payload_fingerprint, summary_json
)
SELECT
  id, CAST(employee_id AS TEXT), kind, event_on, recorded_at, recorded_by_account_id,
  CAST(requested_by_employee_id AS TEXT), source_type, source_application_id,
  corrects_action_id, operation_id, payload_fingerprint, summary_json
FROM company_personnel_actions;
INSERT INTO _company_schema_rebuild_validation
VALUES (
  'personnel-actions',
  (SELECT count(*) FROM company_personnel_actions),
  (SELECT count(*) FROM __new_company_personnel_actions)
);
DROP TABLE company_personnel_actions;
ALTER TABLE __new_company_personnel_actions RENAME TO company_personnel_actions;

UPDATE company_employee_status_period_versions
SET employment_period_id = 'employment:' || employment_period_id;

UPDATE company_employment_period_versions
SET period_id = 'employment:' || period_id;

UPDATE company_organization_assignment_period_versions
SET employee_id = substr(employee_id, length('employee:') + 1)
WHERE employee_id LIKE 'employee:%';

UPDATE company_organization_assignment_period_versions
SET manager_employee_id = substr(manager_employee_id, length('employee:') + 1)
WHERE manager_employee_id LIKE 'employee:%';

UPDATE company_organization_responsibility_period_versions
SET employee_id = substr(employee_id, length('employee:') + 1)
WHERE employee_id LIKE 'employee:%';

UPDATE company_organization_change_operations
SET recorded_at = recorded_at * 1000
WHERE recorded_at > 0 AND recorded_at < 100000000000;

UPDATE company_organization_lifecycle_states
SET updated_at = updated_at * 1000
WHERE updated_at > 0 AND updated_at < 100000000000;

UPDATE company_organization_units
SET created_at = created_at * 1000
WHERE created_at > 0 AND created_at < 100000000000;

UPDATE company_organization_unit_period_versions
SET recorded_at = recorded_at * 1000
WHERE recorded_at > 0 AND recorded_at < 100000000000;

UPDATE company_organization_assignment_period_versions
SET recorded_at = recorded_at * 1000
WHERE recorded_at > 0 AND recorded_at < 100000000000;

UPDATE company_organization_responsibility_period_versions
SET recorded_at = recorded_at * 1000
WHERE recorded_at > 0 AND recorded_at < 100000000000;

DROP TABLE _company_schema_rebuild_validation;
DROP TABLE _company_organization_projection_cutover_validation;

PRAGMA foreign_key_check;
