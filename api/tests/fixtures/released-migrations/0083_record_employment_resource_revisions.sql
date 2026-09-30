CREATE TABLE _company_personnel_actions_with_employment_revisions (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN (
    'hire', 'rehire', 'primary_assignment_started', 'transferred',
    'concurrent_assignment_started', 'assignment_ended', 'position_changed',
    'manager_changed', 'department_responsibility_started',
    'department_responsibility_ended', 'leave_started', 'returned', 'retired',
    'corrected', 'initial_state', 'employment_revised'
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

INSERT INTO _company_personnel_actions_with_employment_revisions (rowid, id, employee_id, kind, event_on, recorded_at, recorded_by_account_id, requested_by_employee_id, source_type, source_application_id, corrects_action_id, operation_id, payload_fingerprint, summary_json)
SELECT rowid, id, employee_id, kind, event_on, recorded_at, recorded_by_account_id, requested_by_employee_id, source_type, source_application_id, corrects_action_id, operation_id, payload_fingerprint, summary_json FROM company_personnel_actions;

CREATE TABLE _company_personnel_action_copy_validation (ok INTEGER NOT NULL CHECK (ok = 1));
INSERT INTO _company_personnel_action_copy_validation (ok)
SELECT NOT EXISTS (
  SELECT rowid, id, employee_id, kind, event_on, recorded_at, recorded_by_account_id, requested_by_employee_id, source_type, source_application_id, corrects_action_id, operation_id, payload_fingerprint, summary_json FROM company_personnel_actions
  EXCEPT SELECT rowid, id, employee_id, kind, event_on, recorded_at, recorded_by_account_id, requested_by_employee_id, source_type, source_application_id, corrects_action_id, operation_id, payload_fingerprint, summary_json FROM _company_personnel_actions_with_employment_revisions
) AND NOT EXISTS (
  SELECT rowid, id, employee_id, kind, event_on, recorded_at, recorded_by_account_id, requested_by_employee_id, source_type, source_application_id, corrects_action_id, operation_id, payload_fingerprint, summary_json FROM _company_personnel_actions_with_employment_revisions
  EXCEPT SELECT rowid, id, employee_id, kind, event_on, recorded_at, recorded_by_account_id, requested_by_employee_id, source_type, source_application_id, corrects_action_id, operation_id, payload_fingerprint, summary_json FROM company_personnel_actions
);

DROP TABLE company_personnel_actions;
ALTER TABLE _company_personnel_actions_with_employment_revisions RENAME TO company_personnel_actions;
DROP TABLE _company_personnel_action_copy_validation;

CREATE INDEX idx_company_personnel_actions_employee_timeline
  ON company_personnel_actions(employee_id, event_on, recorded_at, id);

CREATE UNIQUE INDEX uq_company_personnel_actions_correction
  ON company_personnel_actions(corrects_action_id)
  WHERE corrects_action_id IS NOT NULL;

CREATE UNIQUE INDEX uq_company_personnel_actions_source_application
  ON company_personnel_actions(source_application_id)
  WHERE source_application_id IS NOT NULL;
