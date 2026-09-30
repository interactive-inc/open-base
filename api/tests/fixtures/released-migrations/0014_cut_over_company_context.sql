-- 既存の Company workforce を共通 Company contract へデータごと切り替える。

CREATE TABLE _company_context_cutover_validation (
  resource TEXT PRIMARY KEY NOT NULL,
  source_count INTEGER NOT NULL,
  target_count INTEGER NOT NULL,
  CHECK (source_count = target_count)
);

CREATE TABLE company_employees (
  id TEXT PRIMARY KEY NOT NULL
    CHECK (length(id) BETWEEN 1 AND 128),
  official_name TEXT NOT NULL
    CHECK (length(official_name) BETWEEN 1 AND 200 AND trim(official_name) = official_name),
  employee_code TEXT
    CHECK (
      employee_code IS NULL OR (
        length(employee_code) BETWEEN 1 AND 64 AND trim(employee_code) = employee_code
      )
    ),
  email TEXT
    CHECK (email IS NULL OR (length(email) BETWEEN 1 AND 320 AND trim(email) = email)),
  phone TEXT
    CHECK (phone IS NULL OR (length(phone) BETWEEN 1 AND 64 AND trim(phone) = phone)),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
    CHECK (updated_at >= created_at)
);

CREATE UNIQUE INDEX company_employees_employee_code_uniq
  ON company_employees(employee_code);

INSERT INTO company_employees (
  id, official_name, employee_code, email, phone, created_at, updated_at
)
SELECT
  CAST(employee.id AS TEXT),
  employee.name,
  employee.code,
  (
    SELECT profile.email
    FROM account_employee_links link
    INNER JOIN system_identity_bindings binding
      ON binding.account_id = link.account_id AND binding.revoked_at IS NULL
    INNER JOIN system_identity_profiles profile
      ON profile.identity_id = binding.id
    WHERE link.employee_id = employee.id AND profile.email IS NOT NULL
    ORDER BY profile.email_verified DESC, binding.id
    LIMIT 1
  ),
  employee.phone,
  0,
  coalesce(employee.archived_at, 0)
FROM employees employee;

INSERT INTO _company_context_cutover_validation
VALUES (
  'employees',
  (SELECT count(*) FROM employees),
  (SELECT count(*) FROM company_employees)
);

CREATE TABLE company_employments (
  id TEXT PRIMARY KEY NOT NULL,
  employee_id TEXT NOT NULL
    REFERENCES company_employees(id) ON DELETE RESTRICT,
  contract_name TEXT NOT NULL
    CHECK (length(contract_name) BETWEEN 1 AND 200 AND trim(contract_name) = contract_name),
  employment_type TEXT NOT NULL
    CHECK (employment_type IN ('FULL_TIME', 'PART_TIME')),
  hire_date TEXT NOT NULL,
  status TEXT NOT NULL
    CHECK (status IN ('ACTIVE', 'ON_LEAVE', 'TERMINATED')),
  termination_date TEXT,
  created_at INTEGER NOT NULL
    CHECK (created_at >= 0),
  updated_at INTEGER NOT NULL
    CHECK (updated_at >= created_at),
  CHECK (termination_date IS NULL OR hire_date <= termination_date)
);

CREATE INDEX company_employments_employee_idx
  ON company_employments(employee_id);

CREATE INDEX company_employments_status_idx
  ON company_employments(status);

CREATE UNIQUE INDEX company_employments_employee_active_unique
  ON company_employments(employee_id)
  WHERE termination_date IS NULL;

WITH latest_periods AS (
  SELECT period.*
  FROM employment_period_versions period
  WHERE period.revision = (
    SELECT max(candidate.revision)
    FROM employment_period_versions candidate
    WHERE candidate.period_id = period.period_id
  )
), latest_statuses AS (
  SELECT status.*
  FROM employee_status_period_versions status
  WHERE status.revision = (
    SELECT max(candidate.revision)
    FROM employee_status_period_versions candidate
    WHERE candidate.period_id = status.period_id
  )
)
INSERT INTO company_employments (
  id, employee_id, contract_name, employment_type, hire_date, status,
  termination_date, created_at, updated_at
)
SELECT
  'employment:' || period.period_id,
  CAST(period.employee_id AS TEXT),
  employee.name,
  'FULL_TIME',
  period.starts_on,
  CASE
    WHEN period.is_void = 1 OR period.ends_on IS NOT NULL THEN 'TERMINATED'
    WHEN status.status = 'leave' OR employee.status = 'leave' THEN 'ON_LEAVE'
    WHEN status.status = 'retired' OR employee.status = 'retired' THEN 'TERMINATED'
    ELSE 'ACTIVE'
  END,
  CASE
    WHEN period.is_void = 1 OR period.ends_on IS NOT NULL THEN coalesce(period.ends_on, period.starts_on)
    WHEN status.status = 'retired' OR employee.status = 'retired' THEN period.starts_on
    ELSE NULL
  END,
  0,
  coalesce(employee.archived_at, period.recorded_at, 0)
FROM latest_periods period
INNER JOIN employees employee ON employee.id = period.employee_id
LEFT JOIN latest_statuses status ON status.employment_period_id = period.period_id;

INSERT INTO company_employments (
  id, employee_id, contract_name, employment_type, hire_date, status,
  termination_date, created_at, updated_at
)
SELECT
  'employment:employee:' || employee.id,
  CAST(employee.id AS TEXT),
  employee.name,
  'FULL_TIME',
  '1970-01-01',
  CASE employee.status
    WHEN 'leave' THEN 'ON_LEAVE'
    WHEN 'retired' THEN 'TERMINATED'
    ELSE 'ACTIVE'
  END,
  CASE WHEN employee.status = 'retired' THEN '1970-01-01' ELSE NULL END,
  0,
  coalesce(employee.archived_at, 0)
FROM employees employee
WHERE NOT EXISTS (
  SELECT 1 FROM employment_period_versions period WHERE period.employee_id = employee.id
);

INSERT INTO _company_context_cutover_validation
VALUES (
  'employment-owners',
  (SELECT count(*) FROM employees),
  (SELECT count(DISTINCT employee_id) FROM company_employments)
);

CREATE TABLE company_employment_attributes (
  id TEXT PRIMARY KEY NOT NULL,
  employment_id TEXT NOT NULL
    REFERENCES company_employments(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  position INTEGER NOT NULL
    CHECK (position >= 0),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
    CHECK (updated_at >= created_at)
);

CREATE INDEX company_employment_attributes_employment_idx
  ON company_employment_attributes(employment_id);

CREATE TABLE company_account_employee_links (
  account_id TEXT PRIMARY KEY NOT NULL
    REFERENCES system_accounts(id) ON DELETE RESTRICT,
  employee_id TEXT NOT NULL
    REFERENCES company_employees(id) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX company_account_employee_links_employee_uniq
  ON company_account_employee_links(employee_id);

CREATE INDEX company_account_employee_links_employee_idx
  ON company_account_employee_links(employee_id);

INSERT INTO company_account_employee_links (account_id, employee_id)
SELECT account_id, CAST(employee_id AS TEXT)
FROM account_employee_links;

INSERT INTO _company_context_cutover_validation
VALUES (
  'account-employee-links',
  (SELECT count(*) FROM account_employee_links),
  (SELECT count(*) FROM company_account_employee_links)
);

DROP TABLE account_employee_links;
DROP TABLE employees;

DROP VIEW company_audit_events;
ALTER TABLE audit_batch_decisions RENAME TO company_audit_batch_decisions;
ALTER TABLE audit_event_employee_contexts RENAME TO company_audit_event_employee_contexts;
ALTER TABLE audit_events RENAME TO company_audit_events;
ALTER TABLE audit_logs_append_guard RENAME TO company_audit_append_guard;
ALTER TABLE departments RENAME TO company_departments;
ALTER TABLE employee_events RENAME TO company_employee_events;
ALTER TABLE employee_grades RENAME TO company_employee_grades;
ALTER TABLE employee_lifecycle_revisions RENAME TO company_employee_lifecycle_revisions;
ALTER TABLE employee_org_assignment_period_versions RENAME TO company_employee_org_assignment_period_versions;
ALTER TABLE employee_org_responsibility_period_versions RENAME TO company_employee_org_responsibility_period_versions;
ALTER TABLE employee_status_period_versions RENAME TO company_employee_status_period_versions;
ALTER TABLE employment_period_versions RENAME TO company_employment_period_versions;
ALTER TABLE grade_definitions RENAME TO company_grade_definitions;
ALTER TABLE lifecycle_effect_template_bindings RENAME TO company_lifecycle_effect_template_bindings;
ALTER TABLE lifecycle_outbox_entries RENAME TO company_lifecycle_outbox_entries;
ALTER TABLE org_departments RENAME TO company_org_departments;
ALTER TABLE org_memberships RENAME TO company_org_memberships;
ALTER TABLE organization_assignment_period_versions RENAME TO company_organization_assignment_period_versions;
ALTER TABLE organization_change_operations RENAME TO company_organization_change_operations;
ALTER TABLE organization_lifecycle_states RENAME TO company_organization_lifecycle_states;
ALTER TABLE organization_responsibility_period_versions RENAME TO company_organization_responsibility_period_versions;
ALTER TABLE organization_unit_period_versions RENAME TO company_organization_unit_period_versions;
ALTER TABLE organization_units RENAME TO company_organization_units;
ALTER TABLE personnel_action_requests RENAME TO company_personnel_action_requests;
ALTER TABLE personnel_actions RENAME TO company_personnel_actions;
ALTER TABLE position_definitions RENAME TO company_position_definitions;
ALTER TABLE department_budgets RENAME TO expense_budgets;

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

DROP TABLE _company_context_cutover_validation;

PRAGMA foreign_key_check;
