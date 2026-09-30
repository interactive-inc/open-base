DROP INDEX IF EXISTS idx_audit_event_employee_contexts_employee;
CREATE INDEX idx_company_audit_event_employee_contexts_employee
  ON company_audit_event_employee_contexts(employee_id, audit_event_id);

DROP INDEX IF EXISTS idx_audit_logs_request;
DROP INDEX IF EXISTS idx_audit_logs_actor;
DROP INDEX IF EXISTS idx_audit_logs_action;
DROP INDEX IF EXISTS idx_audit_logs_target;
DROP INDEX IF EXISTS idx_audit_logs_outcome;
DROP INDEX IF EXISTS idx_audit_logs_created;
CREATE INDEX idx_company_audit_events_request
  ON company_audit_events(request_id);
CREATE INDEX idx_company_audit_events_actor
  ON company_audit_events(actor_account_id, created_at, id);
CREATE INDEX idx_company_audit_events_action
  ON company_audit_events(action, created_at, id);
CREATE INDEX idx_company_audit_events_target
  ON company_audit_events(target_type, target_id, created_at, id);
CREATE INDEX idx_company_audit_events_outcome
  ON company_audit_events(outcome, created_at, id);
CREATE INDEX idx_company_audit_events_created
  ON company_audit_events(created_at, id);

DROP INDEX IF EXISTS idx_employee_events_employee;
DROP INDEX IF EXISTS idx_employee_events_kind;
CREATE INDEX idx_company_employee_events_employee
  ON company_employee_events(employee_id);
CREATE INDEX idx_company_employee_events_kind
  ON company_employee_events(kind);

DROP INDEX IF EXISTS idx_employee_grades_employee;
DROP INDEX IF EXISTS uq_employee_grades_employee_effective_date;
CREATE INDEX idx_company_employee_grades_employee
  ON company_employee_grades(employee_id);
CREATE UNIQUE INDEX uq_company_employee_grades_employee_effective_date
  ON company_employee_grades(employee_id, effective_date);

DROP INDEX IF EXISTS idx_employee_status_period_versions_employee;
DROP INDEX IF EXISTS idx_employee_status_period_versions_employment;
CREATE INDEX idx_company_employee_status_period_versions_employee
  ON company_employee_status_period_versions(
    employee_id, starts_on, ends_on, period_id, revision DESC
  );
CREATE INDEX idx_company_employee_status_period_versions_employment
  ON company_employee_status_period_versions(employment_period_id, period_id, revision DESC);

DROP INDEX IF EXISTS idx_employment_period_versions_employee;
CREATE INDEX idx_company_employment_period_versions_employee
  ON company_employment_period_versions(
    employee_id, starts_on, ends_on, period_id, revision DESC
  );

DROP INDEX IF EXISTS idx_lifecycle_outbox_pending;
DROP INDEX IF EXISTS uq_lifecycle_outbox_action_effect;
CREATE INDEX idx_company_lifecycle_outbox_pending
  ON company_lifecycle_outbox_entries(processed_at, next_attempt_at, id);
CREATE UNIQUE INDEX uq_company_lifecycle_outbox_action_effect
  ON company_lifecycle_outbox_entries(personnel_action_id, effect_type);

DROP INDEX IF EXISTS idx_personnel_action_requests_target;
DROP INDEX IF EXISTS idx_personnel_action_requests_target_created;
DROP INDEX IF EXISTS uq_personnel_action_requests_applied_action;
DROP INDEX IF EXISTS uq_personnel_action_requests_system_series;
CREATE INDEX idx_company_personnel_action_requests_target
  ON company_personnel_action_requests(target_employee_id, created_at, id);
CREATE UNIQUE INDEX uq_company_personnel_action_requests_applied_action
  ON company_personnel_action_requests(applied_action_id)
  WHERE applied_action_id IS NOT NULL;
CREATE UNIQUE INDEX uq_company_personnel_action_requests_system_series
  ON company_personnel_action_requests(system_proposal_series_id)
  WHERE system_proposal_series_id IS NOT NULL;

DROP INDEX IF EXISTS idx_personnel_actions_employee_timeline;
DROP INDEX IF EXISTS uq_personnel_actions_correction;
DROP INDEX IF EXISTS uq_personnel_actions_source_application;
CREATE INDEX idx_company_personnel_actions_employee_timeline
  ON company_personnel_actions(employee_id, event_on, recorded_at, id);
CREATE UNIQUE INDEX uq_company_personnel_actions_correction
  ON company_personnel_actions(corrects_action_id)
  WHERE corrects_action_id IS NOT NULL;
CREATE UNIQUE INDEX uq_company_personnel_actions_source_application
  ON company_personnel_actions(source_application_id)
  WHERE source_application_id IS NOT NULL;

DROP INDEX IF EXISTS organization_unit_period_versions_unit_idx;
DROP INDEX IF EXISTS organization_unit_period_versions_code_idx;
DROP INDEX IF EXISTS organization_unit_period_versions_parent_idx;
CREATE INDEX company_organization_unit_period_versions_unit_idx
  ON company_organization_unit_period_versions(
    organization_unit_id, starts_on, ends_on, period_id, revision
  );
CREATE INDEX company_organization_unit_period_versions_code_idx
  ON company_organization_unit_period_versions(code, starts_on, ends_on, period_id, revision);
CREATE INDEX company_organization_unit_period_versions_parent_idx
  ON company_organization_unit_period_versions(parent_organization_unit_id, starts_on, ends_on);

DROP INDEX IF EXISTS organization_assignment_period_versions_employee_idx;
DROP INDEX IF EXISTS organization_assignment_period_versions_unit_idx;
CREATE INDEX company_organization_assignment_period_versions_employee_idx
  ON company_organization_assignment_period_versions(
    employee_id, starts_on, ends_on, assignment_type, period_id, revision
  );
CREATE INDEX company_organization_assignment_period_versions_unit_idx
  ON company_organization_assignment_period_versions(
    organization_unit_id, starts_on, ends_on, period_id, revision
  );

DROP INDEX IF EXISTS organization_responsibility_period_versions_employee_idx;
DROP INDEX IF EXISTS organization_responsibility_period_versions_unit_idx;
CREATE INDEX company_organization_responsibility_period_versions_employee_idx
  ON company_organization_responsibility_period_versions(
    employee_id, starts_on, ends_on, period_id, revision
  );
CREATE INDEX company_organization_responsibility_period_versions_unit_idx
  ON company_organization_responsibility_period_versions(
    organization_unit_id, responsibility_type, starts_on, ends_on, period_id, revision
  );

DROP INDEX IF EXISTS uq_grades_code;
CREATE UNIQUE INDEX uq_company_grade_definitions_code
  ON company_grade_definitions(code);

DROP INDEX IF EXISTS uq_positions_code;
CREATE UNIQUE INDEX uq_company_position_definitions_code
  ON company_position_definitions(code);

PRAGMA foreign_key_check;
