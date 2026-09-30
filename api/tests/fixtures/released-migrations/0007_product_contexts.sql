CREATE TABLE account_employee_links (
  account_id TEXT PRIMARY KEY NOT NULL
    REFERENCES system_accounts(id) ON DELETE CASCADE,
  employee_id INTEGER NOT NULL UNIQUE
    REFERENCES employees(id) ON DELETE RESTRICT
);

CREATE TABLE announcements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  body_md TEXT NOT NULL,
  published_on TEXT,
  author_employee_id INTEGER NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE antisocial_checks (
  id TEXT PRIMARY KEY,
  requester_id INTEGER NOT NULL,
  partner_name TEXT NOT NULL,
  partner_address TEXT,
  representative_name TEXT,
  result TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE asset_lendings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_code TEXT NOT NULL,
  employee_id INTEGER NOT NULL,
  lent_at TEXT NOT NULL,
  returned_at TEXT
);

CREATE TABLE assets (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  serial TEXT,
  purchased_on TEXT,
  status TEXT NOT NULL,
  holder_employee_id INTEGER
, disposed_on TEXT, disposal_reason TEXT);

CREATE TABLE attendance_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL,
  work_date TEXT NOT NULL,
  clock_in_at TEXT,
  clock_out_at TEXT,
  work_minutes INTEGER,
  note TEXT,
  status TEXT NOT NULL
);

CREATE TABLE audit_batch_decisions (
  decision_id TEXT PRIMARY KEY,
  decision_value TEXT NOT NULL,
  CHECK (length(decision_id) BETWEEN 1 AND 200),
  CHECK (length(decision_value) BETWEEN 1 AND 64)
) WITHOUT ROWID;

CREATE TABLE audit_event_employee_contexts (
  audit_event_id INTEGER PRIMARY KEY,
  employee_id INTEGER NOT NULL
);

CREATE TABLE "audit_events" (
  id INTEGER PRIMARY KEY,
  event_id TEXT NOT NULL UNIQUE,
  request_id TEXT NOT NULL,
  actor_account_id TEXT,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  outcome TEXT NOT NULL CHECK (outcome IN ('succeeded', 'denied', 'failed')),
  reason_code TEXT,
  authorization_json TEXT,
  before_json TEXT,
  after_json TEXT,
  metadata_json TEXT,
  client_ip TEXT,
  client_name TEXT NOT NULL CHECK (client_name IN ('web', 'cli', 'api', 'system')),
  created_at INTEGER NOT NULL,
  CHECK (actor_account_id IS NULL OR length(actor_account_id) BETWEEN 1 AND 255)
);

CREATE TABLE audit_logs_append_guard (
  audit_id INTEGER NOT NULL UNIQUE,
  event_id TEXT NOT NULL PRIMARY KEY
) WITHOUT ROWID;

CREATE TABLE business_trips (
  id TEXT PRIMARY KEY,
  traveler_id INTEGER NOT NULL,
  destination TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  purpose TEXT NOT NULL,
  estimated_cost INTEGER,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE career_applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  posting_id INTEGER NOT NULL,
  applicant_id INTEGER NOT NULL,
  message TEXT,
  status TEXT NOT NULL
);

CREATE TABLE career_postings (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  dept_id INTEGER,
  dept_name TEXT,
  required_skills TEXT,
  status TEXT NOT NULL
);

CREATE TABLE career_sheets (
  employee_id INTEGER PRIMARY KEY,
  goals_text TEXT,
  strengths_text TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE certificate_requests (
  id TEXT PRIMARY KEY,
  requester_id INTEGER NOT NULL,
  certificate_type TEXT NOT NULL,
  submit_to TEXT,
  needed_by TEXT,
  note TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE "certification_definitions" (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  issuer TEXT,
  description TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE commendations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  reason TEXT NOT NULL,
  awarded_on TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE company_account_profiles (
  organization_id TEXT NOT NULL REFERENCES company_organizations(id) ON DELETE CASCADE ON UPDATE CASCADE,
  account_id TEXT NOT NULL REFERENCES system_accounts(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL CHECK (
    length(display_name) BETWEEN 1 AND 200
    AND trim(display_name) = display_name
    AND instr(display_name, char(0)) = 0
  ),
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  updated_at INTEGER NOT NULL CHECK (updated_at >= created_at),
  PRIMARY KEY (organization_id, account_id)
);

CREATE TABLE company_audit_event_appends (
  staging_id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id TEXT NOT NULL,
  request_id TEXT NOT NULL,
  actor_account_id TEXT,
  actor_employee_id INTEGER,
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

CREATE TABLE company_calendar_days (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  calendar_date TEXT NOT NULL,
  kind TEXT NOT NULL,
  name TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE company_command_receipts (
  organization_id TEXT NOT NULL REFERENCES company_organizations(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  command_id TEXT NOT NULL,
  fingerprint TEXT NOT NULL CHECK (length(fingerprint) = 64),
  expected_revision INTEGER NOT NULL CHECK (expected_revision >= 0),
  organization_revision INTEGER NOT NULL CHECK (organization_revision = expected_revision + 1),
  recorded_at INTEGER NOT NULL CHECK (recorded_at >= 0),
  PRIMARY KEY (organization_id, command_id)
);

CREATE TABLE company_organizations (
  id TEXT PRIMARY KEY NOT NULL,
  revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  updated_at INTEGER NOT NULL CHECK (updated_at >= created_at)
, name TEXT NOT NULL DEFAULT ''
  CHECK (length(name) <= 200 AND trim(name) = name AND instr(name, char(0)) = 0), representative_name TEXT NOT NULL DEFAULT ''
  CHECK (
    length(representative_name) <= 200
    AND trim(representative_name) = representative_name
    AND instr(representative_name, char(0)) = 0
  ));

CREATE TABLE company_resource_heads (
  organization_id TEXT NOT NULL REFERENCES company_organizations(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision >= 1),
  organization_revision INTEGER NOT NULL CHECK (organization_revision >= 1),
  state TEXT NOT NULL CHECK (state IN ('active', 'void')),
  effective_from TEXT NOT NULL,
  effective_to TEXT CHECK (effective_to IS NULL OR effective_to > effective_from),
  attributes_json TEXT NOT NULL CHECK (json_valid(attributes_json)),
  updated_at INTEGER NOT NULL CHECK (updated_at >= 0),
  PRIMARY KEY (organization_id, resource_type, resource_id)
);

CREATE TABLE company_resource_revisions (
  organization_id TEXT NOT NULL REFERENCES company_organizations(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision >= 1),
  organization_revision INTEGER NOT NULL CHECK (organization_revision >= 1),
  state TEXT NOT NULL CHECK (state IN ('active', 'void')),
  effective_from TEXT NOT NULL,
  effective_to TEXT CHECK (effective_to IS NULL OR effective_to > effective_from),
  attributes_json TEXT NOT NULL CHECK (json_valid(attributes_json)),
  command_id TEXT NOT NULL,
  actor_account_id TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (length(reason) BETWEEN 1 AND 2000),
  recorded_at INTEGER NOT NULL CHECK (recorded_at >= 0),
  PRIMARY KEY (organization_id, resource_type, resource_id, revision)
);

CREATE TABLE "decision_records" (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  decided_on TEXT NOT NULL,
  context TEXT NOT NULL,
  decision TEXT NOT NULL,
  consequences TEXT,
  status TEXT NOT NULL,
  superseded_by_id INTEGER,
  created_at TEXT NOT NULL
);

CREATE TABLE "department_budgets" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  department_id INTEGER NOT NULL,
  fiscal_period TEXT NOT NULL,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  amount INTEGER NOT NULL,
  name TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE departments (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE disciplinary_actions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL,
  kind TEXT NOT NULL,
  summary TEXT NOT NULL,
  decided_on TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE "document_ledger_entries" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  category TEXT,
  location TEXT NOT NULL,
  partner_code TEXT,
  expires_on TEXT,
  note TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE employee_certifications (
  id INTEGER PRIMARY KEY,
  employee_id INTEGER NOT NULL,
  certification_id INTEGER NOT NULL,
  acquired_on TEXT NOT NULL,
  expires_on TEXT,
  note TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE employee_events (
  id INTEGER PRIMARY KEY,
  employee_id INTEGER NOT NULL,
  kind TEXT NOT NULL,
  effective_date TEXT NOT NULL,
  from_department_code TEXT,
  to_department_code TEXT,
  note TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE employee_grades (
  id INTEGER PRIMARY KEY,
  employee_id INTEGER NOT NULL,
  grade_id INTEGER NOT NULL,
  effective_date TEXT NOT NULL,
  reason TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE employee_lifecycle_revisions (
  employee_id INTEGER PRIMARY KEY,
  revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  updated_at INTEGER NOT NULL
);

CREATE TABLE "employee_org_assignment_period_versions" (
  period_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision > 0),
  employment_period_id TEXT NOT NULL,
  employee_id INTEGER NOT NULL,
  department_code TEXT NOT NULL,
  assignment_type TEXT NOT NULL CHECK (assignment_type IN ('primary', 'concurrent')),
  position_title TEXT,
  manager_employee_id INTEGER,
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
  CHECK (ends_on IS NULL OR starts_on < ends_on),
  CHECK (manager_employee_id IS NULL OR manager_employee_id != employee_id)
) WITHOUT ROWID;

CREATE TABLE "employee_org_responsibility_period_versions" (
  period_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision > 0),
  department_code TEXT NOT NULL,
  responsibility_type TEXT NOT NULL CHECK (responsibility_type = 'department_manager'),
  employee_id INTEGER NOT NULL,
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

CREATE TABLE employee_skills (
  employee_id INTEGER NOT NULL,
  skill_code TEXT NOT NULL,
  level INTEGER NOT NULL,
  years INTEGER,
  note TEXT,
  PRIMARY KEY (employee_id, skill_code)
);

CREATE TABLE employee_status_period_versions (
  period_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision > 0),
  employment_period_id TEXT NOT NULL,
  employee_id INTEGER NOT NULL,
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

CREATE TABLE employee_work_styles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL,
  style TEXT NOT NULL,
  starts_on TEXT NOT NULL,
  ends_on TEXT,
  note TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE "employees" (
  id INTEGER PRIMARY KEY,
  code TEXT UNIQUE,
  name TEXT NOT NULL,
  dept_id INTEGER,
  dept_name TEXT,
  position TEXT,
  status TEXT NOT NULL CHECK (status IN ('active', 'leave', 'retired')),
  archived_at INTEGER,
  phone TEXT, archived_by_account_id TEXT
  CHECK (
    archived_by_account_id IS NULL
    OR length(archived_by_account_id) BETWEEN 1 AND 255
  ));

CREATE TABLE employment_period_versions (
  period_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision > 0),
  employee_id INTEGER NOT NULL,
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

CREATE TABLE evaluation_sheet_audit_logs (
  id INTEGER PRIMARY KEY,
  sheet_id INTEGER NOT NULL,
  actor_id INTEGER NOT NULL,
  action TEXT NOT NULL,
  from_value TEXT,
  to_value TEXT,
  note TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE evaluation_sheets (
  id INTEGER PRIMARY KEY,
  employee_id INTEGER NOT NULL,
  template_id INTEGER,
  period TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  primary_evaluator_id INTEGER NOT NULL,
  secondary_evaluator_id INTEGER,
  submitted_at TEXT,
  approved_at TEXT,
  finalized_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
, revision INTEGER NOT NULL DEFAULT 1);

CREATE TABLE evaluation_templates (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  period TEXT NOT NULL,
  items TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  created_by INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE expense_approvals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  expense_id INTEGER NOT NULL,
  approver_id INTEGER NOT NULL,
  action TEXT NOT NULL,
  comment TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE expense_attachments (
  expense_id INTEGER NOT NULL,
  attachment_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (expense_id, attachment_id)
);

CREATE TABLE expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL,
  category TEXT NOT NULL,
  amount INTEGER NOT NULL,
  spent_at TEXT NOT NULL,
  note TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE family_care_leaves (
  id TEXT PRIMARY KEY,
  employee_id INTEGER NOT NULL,
  leave_kind TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  note TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE goal_evaluations (
  id INTEGER PRIMARY KEY,
  goal_id INTEGER NOT NULL,
  evaluator_id INTEGER NOT NULL,
  kind TEXT NOT NULL,
  score INTEGER,
  comment TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE governance_acknowledgements (
  version_id TEXT NOT NULL,
  employee_id INTEGER NOT NULL,
  content_hash TEXT NOT NULL,
  acknowledged_at TEXT NOT NULL,
  PRIMARY KEY (version_id, employee_id)
);

CREATE TABLE governance_capabilities (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  owner_org_role_code TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE governance_document_references (
  version_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (
    kind IN ('capability', 'org_role', 'policy', 'procedure', 'guideline', 'control', 'permission', 'training')
  ),
  code TEXT NOT NULL,
  PRIMARY KEY (version_id, kind, code)
);

CREATE TABLE governance_document_versions (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  version TEXT NOT NULL,
  body_md TEXT NOT NULL,
  metadata_json TEXT NOT NULL,
  procedure_json TEXT,
  content_hash TEXT NOT NULL,
  effective_from TEXT,
  effective_to TEXT,
  review_due_on TEXT,
  state TEXT NOT NULL DEFAULT 'draft'
    CHECK (state IN ('draft', 'in_review', 'published', 'superseded', 'rejected')),
  created_by_account_id TEXT NOT NULL CHECK (length(created_by_account_id) BETWEEN 1 AND 255),
  created_at TEXT NOT NULL,
  published_by_account_id TEXT,
  published_at TEXT,
  UNIQUE (document_id, version),
  CHECK (effective_to IS NULL OR effective_from IS NULL OR effective_from < effective_to),
  CHECK (published_by_account_id IS NULL OR length(published_by_account_id) BETWEEN 1 AND 255)
);

CREATE TABLE governance_documents (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('policy', 'procedure', 'guideline', 'control')),
  classification TEXT NOT NULL
    CHECK (classification IN ('public', 'internal', 'confidential', 'restricted')),
  owner_capability_code TEXT NOT NULL,
  steward_org_role_code TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'retired')),
  current_version_id TEXT,
  source_path TEXT NOT NULL UNIQUE,
  created_by_account_id TEXT NOT NULL CHECK (length(created_by_account_id) BETWEEN 1 AND 255),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE governance_org_role_assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  org_role_code TEXT NOT NULL,
  employee_id INTEGER NOT NULL,
  department_code TEXT,
  starts_on TEXT NOT NULL,
  ends_on TEXT,
  source_document_code TEXT,
  created_by_account_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  revoked_by_account_id TEXT,
  revoked_at TEXT,
  CHECK (ends_on IS NULL OR starts_on < ends_on),
  CHECK (length(created_by_account_id) BETWEEN 1 AND 255),
  CHECK (revoked_by_account_id IS NULL OR length(revoked_by_account_id) BETWEEN 1 AND 255)
);

CREATE TABLE governance_org_roles (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  assignment_mode TEXT NOT NULL DEFAULT 'manual'
    CHECK (assignment_mode IN ('manual', 'department_manager')),
  cardinality TEXT NOT NULL DEFAULT 'one'
    CHECK (cardinality IN ('one', 'per_department', 'many')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE governance_publication_approvals (
  version_id TEXT NOT NULL,
  org_role_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  decided_by_employee_id INTEGER,
  decided_at TEXT,
  comment TEXT,
  PRIMARY KEY (version_id, org_role_code)
);

CREATE TABLE "grade_definitions" (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  rank INTEGER NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE headcount_plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fiscal_year INTEGER NOT NULL,
  department_code TEXT,
  planned_count INTEGER NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE health_checkups (
  id INTEGER PRIMARY KEY,
  employee_id INTEGER NOT NULL,
  fiscal_year INTEGER NOT NULL,
  checkup_kind TEXT NOT NULL,
  conducted_on TEXT,
  status TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE it_incidents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  occurred_at TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  severity TEXT,
  status TEXT NOT NULL,
  resolved_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE "job_openings" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  department_code TEXT,
  status TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE knowledge_articles (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  tags TEXT,
  body_md TEXT NOT NULL,
  author_id INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE "leave_balances" (
  employee_id INTEGER NOT NULL,
  fiscal_year TEXT NOT NULL,
  leave_type TEXT NOT NULL,
  granted_days REAL NOT NULL,
  used_days REAL NOT NULL,
  remaining_days REAL NOT NULL,
  PRIMARY KEY (employee_id, fiscal_year, leave_type)
);

CREATE TABLE leave_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL,
  leave_type TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  days INTEGER NOT NULL,
  reason TEXT,
  status TEXT NOT NULL,
  approver_id INTEGER,
  decided_comment TEXT,
  created_at TEXT NOT NULL
, unit TEXT NOT NULL DEFAULT 'full_day', hours REAL, consumed_days REAL);

CREATE TABLE life_events (
  id TEXT PRIMARY KEY,
  employee_id INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  event_date TEXT NOT NULL,
  detail TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE lifecycle_effect_template_bindings (
  effect_type TEXT PRIMARY KEY CHECK (effect_type IN ('hire', 'retired')),
  template_code TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  updated_by_account_id TEXT
  CHECK (
    updated_by_account_id IS NULL
    OR length(updated_by_account_id) BETWEEN 1 AND 255
  )) WITHOUT ROWID;

CREATE TABLE "lifecycle_outbox_entries" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  personnel_action_id TEXT NOT NULL,
  effect_type TEXT NOT NULL CHECK (effect_type IN ('hire', 'retired')),
  payload_json TEXT NOT NULL CHECK (json_valid(payload_json)),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  next_attempt_at INTEGER NOT NULL,
  processed_at INTEGER,
  last_error_code TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE "meeting_minutes_records" (
  id INTEGER PRIMARY KEY,
  meeting_id INTEGER NOT NULL,
  held_on TEXT NOT NULL,
  title TEXT NOT NULL,
  attendees TEXT,
  body_md TEXT NOT NULL,
  author_employee_id INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE meetings (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  cadence TEXT,
  description TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE onboarding_assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL,
  template_code TEXT NOT NULL,
  kind TEXT NOT NULL,
  status TEXT NOT NULL,
  assigned_at TEXT NOT NULL
);

CREATE TABLE onboarding_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  assignment_id INTEGER NOT NULL,
  template_task_code TEXT NOT NULL,
  title TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  status TEXT NOT NULL,
  completed_at TEXT
);

CREATE TABLE onboarding_template_tasks (
  template_code TEXT NOT NULL,
  code TEXT NOT NULL,
  title TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  owner_role TEXT,
  PRIMARY KEY (template_code, code)
);

CREATE TABLE onboarding_templates (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  description TEXT
);

CREATE TABLE one_on_ones (
  id TEXT PRIMARY KEY,
  member_id INTEGER NOT NULL,
  manager_id INTEGER NOT NULL,
  held_at TEXT NOT NULL,
  topics TEXT,
  manager_note TEXT,
  next_action TEXT
, evaluation_sheet_id INTEGER);

CREATE TABLE org_departments (
  code TEXT PRIMARY KEY,
  department_id INTEGER NOT NULL,
  parent_code TEXT,
  manager_employee_code TEXT,
  sort_order INTEGER NOT NULL
, archived_at INTEGER, archived_by_account_id TEXT
  CHECK (
    archived_by_account_id IS NULL
    OR length(archived_by_account_id) BETWEEN 1 AND 255
  ));

CREATE TABLE org_memberships (
  department_code TEXT NOT NULL,
  employee_code TEXT NOT NULL,
  manager_employee_code TEXT,
  PRIMARY KEY (department_code, employee_code)
);

CREATE TABLE organization_assignment_period_versions (
  period_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision >= 1),
  employment_id TEXT NOT NULL CHECK (length(employment_id) BETWEEN 1 AND 200),
  employee_id TEXT NOT NULL CHECK (length(employee_id) BETWEEN 1 AND 128),
  organization_unit_id TEXT NOT NULL
    REFERENCES organization_units(id) ON DELETE RESTRICT,
  assignment_type TEXT NOT NULL CHECK (assignment_type IN ('PRIMARY', 'CONCURRENT')),
  position_title TEXT CHECK (
    position_title IS NULL OR (
      length(position_title) BETWEEN 1 AND 200 AND trim(position_title) = position_title
    )
  ),
  manager_employee_id TEXT CHECK (
    manager_employee_id IS NULL OR manager_employee_id != employee_id
  ),
  starts_on TEXT NOT NULL,
  ends_on TEXT,
  is_void INTEGER NOT NULL DEFAULT 0 CHECK (is_void IN (0, 1)),
  recorded_by_action_id TEXT NOT NULL
    REFERENCES organization_change_operations(id) ON DELETE RESTRICT,
  recorded_at INTEGER NOT NULL CHECK (recorded_at >= 0),
  PRIMARY KEY (period_id, revision),
  CHECK (
    length(starts_on) = 10 AND date(starts_on) IS starts_on
    AND (ends_on IS NULL OR (length(ends_on) = 10 AND date(ends_on) IS ends_on))
    AND (ends_on IS NULL OR starts_on < ends_on)
  )
) WITHOUT ROWID;

CREATE TABLE organization_change_operations (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) BETWEEN 1 AND 128),
  expected_revision INTEGER NOT NULL CHECK (expected_revision >= 0),
  change_count INTEGER NOT NULL CHECK (change_count >= 1),
  applied_count INTEGER NOT NULL DEFAULT 0 CHECK (applied_count BETWEEN 0 AND change_count),
  resulting_revision INTEGER NOT NULL
    CHECK (resulting_revision = expected_revision + change_count),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'COMPLETED')),
  recorded_at INTEGER NOT NULL CHECK (recorded_at >= 0)
, request_fingerprint TEXT NOT NULL
DEFAULT '0000000000000000000000000000000000000000000000000000000000000000'
CHECK (
  length(request_fingerprint) = 64
  AND request_fingerprint NOT GLOB '*[^0-9a-f]*'
), actor_account_id TEXT NOT NULL DEFAULT 'system:initialization'
CHECK (length(actor_account_id) BETWEEN 1 AND 255 AND trim(actor_account_id) = actor_account_id), reason TEXT NOT NULL DEFAULT 'Initialize organization change'
CHECK (length(reason) BETWEEN 1 AND 1000 AND trim(reason) = reason), evidence_references_json TEXT NOT NULL DEFAULT '[]'
CHECK (json_valid(evidence_references_json) AND json_type(evidence_references_json) = 'array'));

CREATE TABLE "organization_lifecycle_states" (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  updated_at INTEGER NOT NULL
);

CREATE TABLE organization_responsibility_period_versions (
  period_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision >= 1),
  employment_id TEXT NOT NULL CHECK (length(employment_id) BETWEEN 1 AND 200),
  employee_id TEXT NOT NULL CHECK (length(employee_id) BETWEEN 1 AND 128),
  organization_unit_id TEXT NOT NULL
    REFERENCES organization_units(id) ON DELETE RESTRICT,
  responsibility_type TEXT NOT NULL CHECK (
    length(responsibility_type) BETWEEN 1 AND 64
    AND responsibility_type GLOB '[A-Z]*'
    AND responsibility_type NOT GLOB '*[^A-Z0-9_]*'
  ),
  starts_on TEXT NOT NULL,
  ends_on TEXT,
  is_void INTEGER NOT NULL DEFAULT 0 CHECK (is_void IN (0, 1)),
  recorded_by_action_id TEXT NOT NULL
    REFERENCES organization_change_operations(id) ON DELETE RESTRICT,
  recorded_at INTEGER NOT NULL CHECK (recorded_at >= 0),
  PRIMARY KEY (period_id, revision),
  CHECK (
    length(starts_on) = 10 AND date(starts_on) IS starts_on
    AND (ends_on IS NULL OR (length(ends_on) = 10 AND date(ends_on) IS ends_on))
    AND (ends_on IS NULL OR starts_on < ends_on)
  )
) WITHOUT ROWID;

CREATE TABLE organization_unit_period_versions (
  period_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision >= 1),
  organization_unit_id TEXT NOT NULL
    REFERENCES organization_units(id) ON DELETE RESTRICT,
  code TEXT NOT NULL
    CHECK (length(code) BETWEEN 1 AND 64 AND trim(code) = code),
  official_name TEXT NOT NULL
    CHECK (length(official_name) BETWEEN 1 AND 200 AND trim(official_name) = official_name),
  kind TEXT NOT NULL
    CHECK (kind IN ('COMPANY', 'DIVISION', 'DEPARTMENT', 'TEAM', 'OTHER')),
  parent_organization_unit_id TEXT
    REFERENCES organization_units(id) ON DELETE RESTRICT,
  starts_on TEXT NOT NULL,
  ends_on TEXT,
  is_void INTEGER NOT NULL DEFAULT 0 CHECK (is_void IN (0, 1)),
  recorded_by_action_id TEXT NOT NULL
    REFERENCES organization_change_operations(id) ON DELETE RESTRICT,
  recorded_at INTEGER NOT NULL CHECK (recorded_at >= 0),
  PRIMARY KEY (period_id, revision),
  CHECK (
    length(starts_on) = 10 AND date(starts_on) IS starts_on
    AND (ends_on IS NULL OR (length(ends_on) = 10 AND date(ends_on) IS ends_on))
    AND (ends_on IS NULL OR starts_on < ends_on)
  ),
  CHECK (
    parent_organization_unit_id IS NULL
    OR parent_organization_unit_id != organization_unit_id
  )
) WITHOUT ROWID;

CREATE TABLE organization_units (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) BETWEEN 1 AND 128),
  created_at INTEGER NOT NULL CHECK (created_at >= 0)
);

CREATE TABLE "partner_contracts" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  partner_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  contract_date TEXT NOT NULL,
  starts_on TEXT,
  ends_on TEXT,
  renewal_deadline TEXT,
  note TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE partners (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT,
  corporate_number TEXT,
  note TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE "performance_goals" (
  id INTEGER PRIMARY KEY,
  employee_id INTEGER NOT NULL,
  period TEXT NOT NULL,
  title TEXT NOT NULL,
  kpi TEXT,
  weight INTEGER NOT NULL,
  status TEXT NOT NULL
, owner_type TEXT NOT NULL DEFAULT 'individual', parent_goal_id INTEGER, department_code TEXT, evaluation_sheet_id INTEGER);

CREATE TABLE personnel_action_requests (
  id TEXT PRIMARY KEY,
  application_id INTEGER NOT NULL UNIQUE,
  target_employee_id INTEGER,
  kind TEXT NOT NULL CHECK (kind IN (
    'hire',
    'rehire',
    'primary_assignment_started',
    'transferred',
    'concurrent_assignment_started',
    'assignment_ended',
    'position_changed',
    'manager_changed',
    'department_responsibility_started',
    'department_responsibility_ended',
    'leave_started',
    'returned',
    'retired',
    'corrected'
  )),
  payload_json TEXT NOT NULL CHECK (json_valid(payload_json)),
  requested_by_employee_id INTEGER NOT NULL,
  base_employee_revision INTEGER CHECK (
    base_employee_revision IS NULL OR base_employee_revision >= 0
  ),
  base_organization_revision INTEGER CHECK (
    base_organization_revision IS NULL OR base_organization_revision >= 0
  ),
  created_at INTEGER NOT NULL,
  applied_action_id TEXT
, withdrawn_at INTEGER, withdrawn_by_employee_id INTEGER, system_proposal_series_id TEXT, subject_snapshot_json TEXT
  CHECK (subject_snapshot_json IS NULL OR json_valid(subject_snapshot_json)), target_department_code TEXT, payload_fingerprint TEXT
  CHECK (payload_fingerprint IS NULL OR length(payload_fingerprint) = 64));

CREATE TABLE personnel_actions (
  id TEXT PRIMARY KEY,
  employee_id INTEGER NOT NULL,
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
  requested_by_employee_id INTEGER,
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

CREATE TABLE "position_definitions" (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  rank INTEGER NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE recruitment_candidates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  position_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  source TEXT,
  stage TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE regulation_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  regulation_id INTEGER NOT NULL,
  version INTEGER NOT NULL,
  body_md TEXT NOT NULL,
  effective_on TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (regulation_id, version)
);

CREATE TABLE regulations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  category TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE rental_reservations (
  id TEXT PRIMARY KEY,
  requester_id INTEGER NOT NULL,
  item_name TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  purpose TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE resignations (
  id TEXT PRIMARY KEY,
  employee_id INTEGER NOT NULL,
  resignation_date TEXT NOT NULL,
  last_working_date TEXT,
  reason TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE review_cycle_policies (
  cycle_id INTEGER PRIMARY KEY,
  policy_json TEXT NOT NULL
);

CREATE TABLE review_cycles (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  period TEXT NOT NULL,
  status TEXT NOT NULL,
  due_date TEXT
);

CREATE TABLE review_forms (
  id INTEGER PRIMARY KEY,
  cycle_id INTEGER NOT NULL,
  subject_employee_id INTEGER NOT NULL,
  reviewer_employee_id INTEGER NOT NULL,
  reviewer_type TEXT NOT NULL,
  answers TEXT NOT NULL,
  score INTEGER,
  status TEXT NOT NULL,
  submitted_at TEXT
, comment TEXT, visibility TEXT NOT NULL DEFAULT 'disclosed');

CREATE TABLE ringi_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  applicant_id INTEGER NOT NULL,
  approver_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  amount INTEGER NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL,
  decided_at TEXT,
  decision_comment TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE room_reservations (
  id TEXT PRIMARY KEY,
  room_id INTEGER NOT NULL,
  reserver_id INTEGER NOT NULL,
  start_at TEXT NOT NULL,
  end_at TEXT NOT NULL,
  purpose TEXT
);

CREATE TABLE rooms (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  capacity INTEGER NOT NULL,
  location TEXT
);

CREATE TABLE salary_revisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL,
  effective_date TEXT NOT NULL,
  previous_base_salary INTEGER NOT NULL,
  new_base_salary INTEGER NOT NULL,
  reason TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE shift_assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL,
  pattern_id INTEGER,
  date TEXT NOT NULL,
  note TEXT,
  published_at TEXT
);

CREATE TABLE shift_patterns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  break_minutes INTEGER NOT NULL
);

CREATE TABLE shift_swap_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  requester_employee_id INTEGER NOT NULL,
  target_employee_id INTEGER NOT NULL,
  date TEXT NOT NULL,
  note TEXT,
  status TEXT NOT NULL,
  approved_at TEXT
);

CREATE TABLE "skill_definitions" (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL
);

CREATE TABLE "software_licenses" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  vendor TEXT,
  category TEXT,
  seats INTEGER,
  renewal_deadline TEXT,
  owner_employee_id INTEGER,
  note TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE stocktake_items (
  stocktake_id TEXT NOT NULL,
  asset_code TEXT NOT NULL,
  checked_at TEXT,
  checker_employee_id INTEGER,
  location_note TEXT,
  PRIMARY KEY (stocktake_id, asset_code)
);

CREATE TABLE stocktakes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  target_date TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  closed_at TEXT
);

CREATE TABLE survey_responses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  survey_id INTEGER NOT NULL,
  respondent_id INTEGER NOT NULL,
  answers_json TEXT NOT NULL,
  submitted_at TEXT NOT NULL
);

CREATE TABLE surveys (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  status TEXT NOT NULL,
  questions_json TEXT NOT NULL
);

CREATE TABLE "thanks_messages" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sender_employee_id INTEGER NOT NULL,
  recipient_employee_id INTEGER NOT NULL,
  message TEXT NOT NULL,
  points INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE thanks_point_budgets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL,
  period TEXT NOT NULL,
  granted_points INTEGER NOT NULL,
  consumed_points INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE thanks_redemptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL,
  reward_id INTEGER NOT NULL,
  point_cost INTEGER NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  decided_at TEXT,
  decider_id INTEGER
);

CREATE TABLE thanks_rewards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  point_cost INTEGER NOT NULL,
  is_active INTEGER NOT NULL,
  stock INTEGER,
  created_at TEXT NOT NULL
);

CREATE TABLE training_courses (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  duration_minutes INTEGER,
  category TEXT NOT NULL,
  is_required INTEGER NOT NULL,
  status TEXT NOT NULL
);

CREATE TABLE training_enrollments (
  id INTEGER PRIMARY KEY,
  course_id INTEGER NOT NULL,
  employee_id INTEGER NOT NULL,
  status TEXT NOT NULL,
  completed_at TEXT,
  score INTEGER,
  due_date TEXT
);

CREATE TABLE work_accidents (
  id INTEGER PRIMARY KEY,
  occurred_on TEXT NOT NULL,
  employee_id INTEGER,
  location TEXT,
  summary TEXT NOT NULL,
  severity TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE VIEW company_audit_events AS
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
FROM audit_events event
LEFT JOIN audit_event_employee_contexts employee_context
  ON employee_context.audit_event_id = event.id;

CREATE INDEX company_account_profiles_account_idx
  ON company_account_profiles (account_id);

CREATE UNIQUE INDEX company_resource_heads_org_revision_idx
  ON company_resource_heads (organization_id, organization_revision, resource_type, resource_id);

CREATE INDEX company_resource_heads_type_effective_idx
  ON company_resource_heads (organization_id, resource_type, effective_from, effective_to);

CREATE INDEX company_resource_revisions_command_idx
  ON company_resource_revisions (organization_id, command_id);

CREATE UNIQUE INDEX company_resource_revisions_org_revision_idx
  ON company_resource_revisions (organization_id, organization_revision, resource_type, resource_id);

CREATE INDEX idx_account_employee_links_employee
  ON account_employee_links (employee_id);

CREATE INDEX idx_announcements_status ON announcements (status);

CREATE INDEX idx_antisocial_checks_requester ON antisocial_checks (requester_id);

CREATE INDEX idx_asset_lendings_asset ON asset_lendings (asset_code);

CREATE INDEX idx_asset_lendings_employee ON asset_lendings (employee_id);

CREATE INDEX idx_assets_holder ON assets (holder_employee_id);

CREATE INDEX idx_assets_kind ON assets (kind);

CREATE INDEX idx_assets_status ON assets (status);

CREATE INDEX idx_attendance_records_employee ON attendance_records (employee_id);

CREATE INDEX idx_attendance_records_employee_open ON attendance_records (employee_id, status);

CREATE UNIQUE INDEX idx_attendance_records_employee_open_unique
  ON attendance_records (employee_id) WHERE status = 'open';

CREATE INDEX idx_attendance_records_work_date ON attendance_records (work_date);

CREATE INDEX idx_audit_event_employee_contexts_employee
  ON audit_event_employee_contexts (employee_id, audit_event_id);

CREATE INDEX idx_audit_logs_action ON audit_events (action, created_at, id);

CREATE INDEX idx_audit_logs_actor ON audit_events (actor_account_id, created_at, id);

CREATE INDEX idx_audit_logs_created ON audit_events (created_at, id);

CREATE INDEX idx_audit_logs_outcome ON audit_events (outcome, created_at, id);

CREATE INDEX idx_audit_logs_request ON audit_events (request_id);

CREATE INDEX idx_audit_logs_target ON audit_events (target_type, target_id, created_at, id);

CREATE INDEX idx_budgets_department ON "department_budgets" (department_id);

CREATE INDEX idx_budgets_fiscal_period ON "department_budgets" (fiscal_period);

CREATE INDEX idx_business_trips_traveler ON business_trips (traveler_id);

CREATE INDEX idx_career_applications_applicant ON career_applications (applicant_id);

CREATE INDEX idx_career_applications_posting ON career_applications (posting_id);

CREATE UNIQUE INDEX idx_career_applications_posting_applicant
  ON career_applications (posting_id, applicant_id);

CREATE INDEX idx_career_postings_status ON career_postings (status);

CREATE INDEX idx_certificate_requests_requester ON certificate_requests (requester_id);

CREATE INDEX idx_certifications_code ON "certification_definitions" (code);

CREATE INDEX idx_commendations_employee ON commendations (employee_id);

CREATE INDEX idx_contracts_partner ON "partner_contracts" (partner_id);

CREATE INDEX idx_decisions_status ON "decision_records" (status);

CREATE INDEX idx_disciplinary_actions_employee ON disciplinary_actions (employee_id);

CREATE INDEX idx_documents_expires_on ON "document_ledger_entries" (expires_on);

CREATE INDEX idx_employee_certifications_certification ON employee_certifications (certification_id);

CREATE INDEX idx_employee_certifications_employee ON employee_certifications (employee_id);

CREATE UNIQUE INDEX idx_employee_certifications_unique
  ON employee_certifications (employee_id, certification_id, acquired_on);

CREATE INDEX idx_employee_events_employee ON employee_events (employee_id);

CREATE INDEX idx_employee_events_kind ON employee_events (kind);

CREATE INDEX idx_employee_grades_employee ON employee_grades (employee_id);

CREATE INDEX idx_employee_skills_employee ON employee_skills (employee_id);

CREATE INDEX idx_employee_status_period_versions_employee
  ON employee_status_period_versions
    (employee_id, starts_on, ends_on, period_id, revision DESC);

CREATE INDEX idx_employee_status_period_versions_employment
  ON employee_status_period_versions (employment_period_id, period_id, revision DESC);

CREATE INDEX idx_employee_work_styles_employee ON employee_work_styles (employee_id);

CREATE INDEX idx_employees_code ON employees (code);

CREATE INDEX idx_employment_period_versions_employee
  ON employment_period_versions (employee_id, starts_on, ends_on, period_id, revision DESC);

CREATE INDEX idx_evaluation_sheet_audit_logs_sheet
ON evaluation_sheet_audit_logs (sheet_id);

CREATE INDEX idx_evaluation_sheets_employee
ON evaluation_sheets (employee_id);

CREATE INDEX idx_evaluation_sheets_period
ON evaluation_sheets (period);

CREATE INDEX idx_evaluation_sheets_status
ON evaluation_sheets (status);

CREATE INDEX idx_evaluation_templates_period
ON evaluation_templates (period);

CREATE INDEX idx_evaluation_templates_status
ON evaluation_templates (status);

CREATE INDEX idx_expense_approvals_expense ON expense_approvals (expense_id);

CREATE INDEX idx_expense_attachments_expense
  ON expense_attachments (expense_id);

CREATE INDEX idx_expenses_employee ON expenses (employee_id);

CREATE INDEX idx_expenses_status ON expenses (status);

CREATE INDEX idx_family_care_leaves_employee ON family_care_leaves (employee_id);

CREATE UNIQUE INDEX idx_goal_evaluations_evaluator_kind
ON goal_evaluations (goal_id, evaluator_id, kind)
WHERE kind IN ('self', 'manager');

CREATE INDEX idx_goal_evaluations_goal ON goal_evaluations (goal_id);

CREATE UNIQUE INDEX idx_goal_evaluations_goal_final
ON goal_evaluations (goal_id)
WHERE kind = 'final';

CREATE INDEX idx_goals_department ON "performance_goals" (department_code);

CREATE INDEX idx_goals_employee ON "performance_goals" (employee_id);

CREATE INDEX idx_goals_owner_type ON "performance_goals" (owner_type);

CREATE INDEX idx_goals_parent ON "performance_goals" (parent_goal_id);

CREATE INDEX idx_goals_period ON "performance_goals" (period);

CREATE INDEX idx_governance_role_assignments_employee
  ON governance_org_role_assignments (employee_id);

CREATE INDEX idx_governance_role_assignments_role_period
  ON governance_org_role_assignments (org_role_code, starts_on, ends_on);

CREATE INDEX idx_governance_versions_document_state
  ON governance_document_versions (document_id, state);

CREATE INDEX idx_health_checkups_employee ON health_checkups (employee_id);

CREATE INDEX idx_health_checkups_fiscal_year ON health_checkups (fiscal_year);

CREATE INDEX idx_it_incidents_occurred_at ON it_incidents (occurred_at);

CREATE INDEX idx_knowledge_articles_category ON knowledge_articles (category);

CREATE INDEX idx_leave_balances_employee ON leave_balances (employee_id, fiscal_year);

CREATE INDEX idx_leave_requests_employee ON leave_requests (employee_id);

CREATE INDEX idx_leave_requests_status ON leave_requests (status);

CREATE INDEX idx_licenses_renewal_deadline ON "software_licenses" (renewal_deadline);

CREATE INDEX idx_life_events_employee ON life_events (employee_id);

CREATE INDEX idx_lifecycle_outbox_pending
  ON "lifecycle_outbox_entries" (processed_at, next_attempt_at, id);

CREATE INDEX idx_meeting_minutes_meeting ON "meeting_minutes_records" (meeting_id);

CREATE INDEX idx_meetings_status ON meetings (status);

CREATE INDEX idx_onboarding_assignments_employee ON onboarding_assignments (employee_id);

CREATE INDEX idx_onboarding_tasks_assignment ON onboarding_tasks (assignment_id);

CREATE INDEX idx_onboarding_template_tasks_template ON onboarding_template_tasks (template_code);

CREATE INDEX idx_onboarding_templates_kind ON onboarding_templates (kind);

CREATE INDEX idx_one_on_ones_evaluation_sheet
ON one_on_ones (evaluation_sheet_id);

CREATE INDEX idx_one_on_ones_manager ON one_on_ones (manager_id);

CREATE INDEX idx_one_on_ones_member ON one_on_ones (member_id);

CREATE INDEX idx_org_assignment_period_versions_department
  ON "employee_org_assignment_period_versions"
    (department_code, starts_on, ends_on, period_id, revision DESC);

CREATE INDEX idx_org_assignment_period_versions_employee
  ON "employee_org_assignment_period_versions"
    (employee_id, starts_on, ends_on, assignment_type, period_id, revision DESC);

CREATE INDEX idx_org_memberships_employee ON org_memberships (employee_code);

CREATE INDEX idx_org_responsibility_period_versions_department
  ON "employee_org_responsibility_period_versions"
    (department_code, responsibility_type, starts_on, ends_on, period_id, revision DESC);

CREATE INDEX idx_org_responsibility_period_versions_employee
  ON "employee_org_responsibility_period_versions"
    (employee_id, starts_on, ends_on, period_id, revision DESC);

CREATE INDEX idx_partners_status ON partners (status);

CREATE INDEX idx_performance_goals_evaluation_sheet
ON performance_goals (evaluation_sheet_id);

CREATE INDEX idx_personnel_action_requests_target
  ON personnel_action_requests (target_employee_id, created_at DESC);

CREATE INDEX idx_personnel_action_requests_target_created
  ON personnel_action_requests (target_employee_id, created_at DESC, id DESC);

CREATE INDEX idx_personnel_actions_employee_timeline
  ON personnel_actions (employee_id, event_on DESC, recorded_at DESC, id DESC);

CREATE INDEX idx_recruitment_candidates_position ON recruitment_candidates (position_id);

CREATE INDEX idx_recruitment_positions_status ON "job_openings" (status);

CREATE INDEX idx_regulation_versions_regulation ON regulation_versions (regulation_id);

CREATE INDEX idx_regulations_status ON regulations (status);

CREATE INDEX idx_rental_reservations_requester ON rental_reservations (requester_id);

CREATE INDEX idx_resignations_employee ON resignations (employee_id);

CREATE UNIQUE INDEX idx_resignations_employee_requested
ON resignations (employee_id)
WHERE status = 'requested';

CREATE INDEX idx_review_cycles_status ON review_cycles (status);

CREATE INDEX idx_review_forms_cycle_subject ON review_forms (cycle_id, subject_employee_id);

CREATE INDEX idx_review_forms_reviewer ON review_forms (reviewer_employee_id);

CREATE INDEX idx_ringi_requests_applicant ON ringi_requests (applicant_id);

CREATE INDEX idx_ringi_requests_approver ON ringi_requests (approver_id);

CREATE INDEX idx_ringi_requests_status ON ringi_requests (status);

CREATE INDEX idx_room_reservations_reserver ON room_reservations (reserver_id);

CREATE INDEX idx_room_reservations_room ON room_reservations (room_id);

CREATE INDEX idx_room_reservations_room_time ON room_reservations (room_id, start_at, end_at);

CREATE INDEX idx_rooms_capacity ON rooms (capacity);

CREATE INDEX idx_salary_revisions_employee ON salary_revisions (employee_id);

CREATE INDEX idx_shift_assignments_date ON shift_assignments (date);

CREATE INDEX idx_shift_assignments_employee ON shift_assignments (employee_id);

CREATE INDEX idx_shift_assignments_pattern ON shift_assignments (pattern_id);

CREATE INDEX idx_shift_patterns_code ON shift_patterns (code);

CREATE UNIQUE INDEX idx_shift_swap_requests_pending
ON shift_swap_requests (requester_employee_id, target_employee_id, date)
WHERE status = 'pending';

CREATE INDEX idx_shift_swap_requests_requester ON shift_swap_requests (requester_employee_id);

CREATE INDEX idx_skills_category ON "skill_definitions" (category);

CREATE INDEX idx_stocktake_items_asset ON stocktake_items (asset_code);

CREATE INDEX idx_stocktakes_status ON stocktakes (status);

CREATE INDEX idx_survey_responses_respondent ON survey_responses (respondent_id);

CREATE INDEX idx_survey_responses_survey ON survey_responses (survey_id);

CREATE UNIQUE INDEX idx_survey_responses_survey_respondent
  ON survey_responses (survey_id, respondent_id);

CREATE INDEX idx_surveys_status ON surveys (status);

CREATE INDEX idx_thanks_created_at ON "thanks_messages" (created_at);

CREATE INDEX idx_thanks_recipient ON "thanks_messages" (recipient_employee_id);

CREATE INDEX idx_thanks_redemptions_employee ON thanks_redemptions (employee_id);

CREATE UNIQUE INDEX idx_thanks_redemptions_employee_pending
  ON thanks_redemptions (employee_id) WHERE status = 'pending';

CREATE INDEX idx_thanks_redemptions_status ON thanks_redemptions (status);

CREATE INDEX idx_training_courses_category ON training_courses (category);

CREATE INDEX idx_training_courses_code ON training_courses (code);

CREATE INDEX idx_training_enrollments_course ON training_enrollments (course_id);

CREATE UNIQUE INDEX idx_training_enrollments_course_employee
  ON training_enrollments (course_id, employee_id);

CREATE INDEX idx_training_enrollments_employee ON training_enrollments (employee_id);

CREATE INDEX idx_work_accidents_employee ON work_accidents (employee_id);

CREATE INDEX idx_work_accidents_occurred_on ON work_accidents (occurred_on);

CREATE INDEX organization_assignment_period_versions_employee_idx
  ON organization_assignment_period_versions (
    employee_id, starts_on, ends_on, assignment_type, period_id, revision
  );

CREATE INDEX organization_assignment_period_versions_unit_idx
  ON organization_assignment_period_versions (
    organization_unit_id, starts_on, ends_on, period_id, revision
  );

CREATE INDEX organization_responsibility_period_versions_employee_idx
  ON organization_responsibility_period_versions (
    employee_id, starts_on, ends_on, period_id, revision
  );

CREATE INDEX organization_responsibility_period_versions_unit_idx
  ON organization_responsibility_period_versions (
    organization_unit_id, responsibility_type, starts_on, ends_on, period_id, revision
  );

CREATE INDEX organization_unit_period_versions_code_idx
  ON organization_unit_period_versions (code, starts_on, ends_on, period_id, revision);

CREATE INDEX organization_unit_period_versions_parent_idx
  ON organization_unit_period_versions (parent_organization_unit_id, starts_on, ends_on);

CREATE INDEX organization_unit_period_versions_unit_idx
  ON organization_unit_period_versions (
    organization_unit_id, starts_on, ends_on, period_id, revision
  );

CREATE UNIQUE INDEX uq_company_calendar_days_date ON company_calendar_days (calendar_date);

CREATE UNIQUE INDEX uq_departments_name ON departments (name);

CREATE UNIQUE INDEX uq_employee_grades_employee_effective_date
  ON employee_grades (employee_id, effective_date);

CREATE UNIQUE INDEX uq_evaluation_sheets_employee_period
ON evaluation_sheets (employee_id, period);

CREATE UNIQUE INDEX uq_grades_code ON "grade_definitions" (code);

CREATE UNIQUE INDEX uq_headcount_plans_year_department
  ON headcount_plans (fiscal_year, department_code);

CREATE UNIQUE INDEX uq_lifecycle_outbox_action_effect
  ON "lifecycle_outbox_entries" (personnel_action_id, effect_type);

CREATE UNIQUE INDEX uq_onboarding_assignments_employee_template
ON onboarding_assignments (employee_id, template_code)
WHERE status != 'completed';

CREATE UNIQUE INDEX uq_personnel_action_requests_applied_action
  ON personnel_action_requests (applied_action_id)
  WHERE applied_action_id IS NOT NULL;

CREATE UNIQUE INDEX uq_personnel_action_requests_system_series
  ON personnel_action_requests (system_proposal_series_id)
  WHERE system_proposal_series_id IS NOT NULL;

CREATE UNIQUE INDEX uq_personnel_actions_correction
  ON personnel_actions (corrects_action_id)
  WHERE corrects_action_id IS NOT NULL;

CREATE UNIQUE INDEX uq_personnel_actions_source_application
  ON personnel_actions (source_application_id)
  WHERE source_application_id IS NOT NULL;

CREATE UNIQUE INDEX uq_positions_code ON "position_definitions" (code);

CREATE UNIQUE INDEX uq_review_form_assignment
  ON review_forms (cycle_id, subject_employee_id, reviewer_employee_id, reviewer_type);

CREATE UNIQUE INDEX uq_salary_revisions_employee_date ON salary_revisions (employee_id, effective_date);

CREATE UNIQUE INDEX uq_shift_assignment_employee_date
  ON shift_assignments (employee_id, date);

CREATE UNIQUE INDEX uq_thanks_point_budgets_employee_period
  ON thanks_point_budgets (employee_id, period);

CREATE TRIGGER audit_event_employee_contexts_prevent_delete
BEFORE DELETE ON audit_event_employee_contexts
BEGIN
  SELECT RAISE(ABORT, 'audit employee context is append-only');
END;

CREATE TRIGGER audit_event_employee_contexts_prevent_update
BEFORE UPDATE ON audit_event_employee_contexts
BEGIN
  SELECT RAISE(ABORT, 'audit employee context is append-only');
END;

CREATE TRIGGER audit_event_employee_contexts_validate_insert
BEFORE INSERT ON audit_event_employee_contexts
WHEN NOT EXISTS (
  SELECT 1 FROM audit_events WHERE id = NEW.audit_event_id
)
BEGIN
  SELECT RAISE(ABORT, 'audit employee context requires an audit event');
END;

CREATE TRIGGER audit_events_append_guard_prevent_delete
BEFORE DELETE ON audit_logs_append_guard
BEGIN
  SELECT RAISE(ABORT, 'audit_events append guard is immutable');
END;

CREATE TRIGGER audit_events_append_guard_prevent_insert
BEFORE INSERT ON audit_logs_append_guard
WHEN
  NOT EXISTS (
    SELECT 1 FROM audit_events
    WHERE id = NEW.audit_id AND event_id = NEW.event_id
  )
  OR EXISTS (
    SELECT 1 FROM audit_logs_append_guard
    WHERE audit_id = NEW.audit_id OR event_id = NEW.event_id
  )
BEGIN
  SELECT RAISE(ABORT, 'audit_events append guard is immutable');
END;

CREATE TRIGGER audit_events_append_guard_prevent_update
BEFORE UPDATE ON audit_logs_append_guard
BEGIN
  SELECT RAISE(ABORT, 'audit_events append guard is immutable');
END;

CREATE TRIGGER audit_events_prevent_delete
BEFORE DELETE ON audit_events
BEGIN
  SELECT RAISE(ABORT, 'audit_events is append-only');
END;

CREATE TRIGGER audit_events_prevent_update
BEFORE UPDATE ON audit_events
BEGIN
  SELECT RAISE(ABORT, 'audit_events is append-only');
END;

CREATE TRIGGER audit_events_register_insert
AFTER INSERT ON audit_events
BEGIN
  SELECT RAISE(ABORT, 'audit_events is append-only')
  WHERE EXISTS (
    SELECT 1 FROM audit_logs_append_guard
    WHERE audit_id = NEW.id OR event_id = NEW.event_id
  );

  INSERT INTO audit_logs_append_guard (audit_id, event_id)
  VALUES (NEW.id, NEW.event_id);
END;

CREATE TRIGGER company_audit_event_appends_dispatch
AFTER INSERT ON company_audit_event_appends
BEGIN
  INSERT INTO audit_events (
    event_id, request_id, actor_account_id, action, target_type, target_id, outcome,
    reason_code, authorization_json, before_json, after_json, metadata_json,
    client_ip, client_name, created_at
  ) VALUES (
    NEW.event_id, NEW.request_id, NEW.actor_account_id, NEW.action, NEW.target_type,
    NEW.target_id, NEW.outcome, NEW.reason_code, NEW.authorization_json, NEW.before_json,
    NEW.after_json, NEW.metadata_json, NEW.client_ip, NEW.client_name, NEW.created_at
  );

  INSERT INTO audit_event_employee_contexts (audit_event_id, employee_id)
  SELECT event.id, NEW.actor_employee_id
  FROM audit_events event
  WHERE event.event_id = NEW.event_id
    AND NEW.actor_employee_id IS NOT NULL;

  DELETE FROM company_audit_event_appends WHERE staging_id = NEW.staging_id;
END;

CREATE TRIGGER company_command_receipts_expected_revision
BEFORE INSERT ON company_command_receipts
WHEN COALESCE(
  (SELECT revision FROM company_organizations WHERE id = NEW.organization_id),
  -1
) <> NEW.expected_revision
BEGIN
  SELECT RAISE(ABORT, 'company_revision_conflict');
END;

CREATE TRIGGER company_command_receipts_no_delete
BEFORE DELETE ON company_command_receipts
BEGIN
  SELECT RAISE(ABORT, 'company_command_receipts_are_immutable');
END;

CREATE TRIGGER company_command_receipts_no_update
BEFORE UPDATE ON company_command_receipts
BEGIN
  SELECT RAISE(ABORT, 'company_command_receipts_are_immutable');
END;

CREATE TRIGGER company_organizations_revision_step
BEFORE UPDATE OF revision ON company_organizations
WHEN NEW.revision <> OLD.revision + 1
BEGIN
  SELECT RAISE(ABORT, 'company_revision_step_invalid');
END;

CREATE TRIGGER company_resource_revisions_expected_revision
BEFORE INSERT ON company_resource_revisions
WHEN NEW.revision <> COALESCE(
  (
    SELECT revision
    FROM company_resource_heads
    WHERE organization_id = NEW.organization_id
      AND resource_type = NEW.resource_type
      AND resource_id = NEW.resource_id
  ),
  0
) + 1
BEGIN
  SELECT RAISE(ABORT, 'company_resource_revision_conflict');
END;

CREATE TRIGGER company_resource_revisions_no_delete
BEFORE DELETE ON company_resource_revisions
BEGIN
  SELECT RAISE(ABORT, 'company_resource_revisions_are_append_only');
END;

CREATE TRIGGER company_resource_revisions_no_update
BEFORE UPDATE ON company_resource_revisions
BEGIN
  SELECT RAISE(ABORT, 'company_resource_revisions_are_append_only');
END;

CREATE TRIGGER employee_org_assignment_operation_guard
BEFORE INSERT ON employee_org_assignment_period_versions
WHEN EXISTS (
  SELECT 1 FROM organization_change_operations WHERE id = NEW.recorded_by_action_id
)
BEGIN
  SELECT RAISE(ABORT, 'organization change operation is missing or stale')
  WHERE NOT EXISTS (
    SELECT 1
    FROM organization_change_operations AS operation
    JOIN organization_lifecycle_states AS state ON state.id = 1
    WHERE operation.id = NEW.recorded_by_action_id
      AND operation.status = 'PENDING'
      AND operation.applied_count < operation.change_count
      AND state.revision = operation.expected_revision + operation.applied_count
  );

  SELECT RAISE(ABORT, 'organization assignment revision is not sequential')
  WHERE NEW.revision != coalesce(
    (
      SELECT max(revision)
      FROM employee_org_assignment_period_versions
      WHERE period_id = NEW.period_id
    ),
    0
  ) + 1;

  SELECT RAISE(ABORT, 'organization assignment unit is not active')
  WHERE NEW.is_void = 0 AND NOT EXISTS (
    SELECT 1 FROM organization_unit_period_versions AS unit
    WHERE unit.organization_unit_id = 'department:' || NEW.department_code
      AND unit.is_void = 0
      AND unit.revision = (
        SELECT max(latest.revision)
        FROM organization_unit_period_versions AS latest
        WHERE latest.period_id = unit.period_id
      )
      AND unit.starts_on <= NEW.starts_on
      AND (
        unit.ends_on IS NULL
        OR (NEW.ends_on IS NOT NULL AND NEW.ends_on <= unit.ends_on)
      )
  );
END;

CREATE TRIGGER employee_org_assignment_operation_state
AFTER INSERT ON employee_org_assignment_period_versions
WHEN EXISTS (
  SELECT 1 FROM organization_change_operations
  WHERE id = NEW.recorded_by_action_id AND status = 'PENDING'
)
BEGIN
  INSERT INTO organization_assignment_period_versions (
    period_id, revision, employment_id, employee_id, organization_unit_id,
    assignment_type, position_title, manager_employee_id, starts_on, ends_on,
    is_void, recorded_by_action_id, recorded_at
  ) VALUES (
    'assignment-period:' || NEW.period_id,
    NEW.revision,
    'employment:' || NEW.employment_period_id,
    'employee:' || NEW.employee_id,
    'department:' || NEW.department_code,
    CASE NEW.assignment_type WHEN 'primary' THEN 'PRIMARY' ELSE 'CONCURRENT' END,
    NEW.position_title,
    CASE
      WHEN NEW.manager_employee_id IS NULL THEN NULL
      ELSE 'employee:' || NEW.manager_employee_id
    END,
    NEW.starts_on,
    NEW.ends_on,
    NEW.is_void,
    NEW.recorded_by_action_id,
    NEW.recorded_at
  );
END;

CREATE TRIGGER employee_org_responsibility_operation_guard
BEFORE INSERT ON employee_org_responsibility_period_versions
WHEN EXISTS (
  SELECT 1 FROM organization_change_operations WHERE id = NEW.recorded_by_action_id
)
BEGIN
  SELECT RAISE(ABORT, 'organization change operation is missing or stale')
  WHERE NOT EXISTS (
    SELECT 1
    FROM organization_change_operations AS operation
    JOIN organization_lifecycle_states AS state ON state.id = 1
    WHERE operation.id = NEW.recorded_by_action_id
      AND operation.status = 'PENDING'
      AND operation.applied_count < operation.change_count
      AND state.revision = operation.expected_revision + operation.applied_count
  );

  SELECT RAISE(ABORT, 'organization responsibility revision is not sequential')
  WHERE NEW.revision != coalesce(
    (
      SELECT max(revision)
      FROM employee_org_responsibility_period_versions
      WHERE period_id = NEW.period_id
    ),
    0
  ) + 1;

  SELECT RAISE(ABORT, 'organization responsibility unit is not active')
  WHERE NEW.is_void = 0 AND NOT EXISTS (
    SELECT 1 FROM organization_unit_period_versions AS unit
    WHERE unit.organization_unit_id = 'department:' || NEW.department_code
      AND unit.is_void = 0
      AND unit.revision = (
        SELECT max(latest.revision)
        FROM organization_unit_period_versions AS latest
        WHERE latest.period_id = unit.period_id
      )
      AND unit.starts_on <= NEW.starts_on
      AND (
        unit.ends_on IS NULL
        OR (NEW.ends_on IS NOT NULL AND NEW.ends_on <= unit.ends_on)
      )
  );
END;

CREATE TRIGGER employee_org_responsibility_operation_state
AFTER INSERT ON employee_org_responsibility_period_versions
WHEN EXISTS (
  SELECT 1 FROM organization_change_operations
  WHERE id = NEW.recorded_by_action_id AND status = 'PENDING'
)
BEGIN
  INSERT INTO organization_responsibility_period_versions (
    period_id, revision, employment_id, employee_id, organization_unit_id,
    responsibility_type, starts_on, ends_on, is_void,
    recorded_by_action_id, recorded_at
  )
  SELECT
    'responsibility-period:' || NEW.period_id,
    NEW.revision,
    'employment:' || employment.period_id,
    'employee:' || NEW.employee_id,
    'department:' || NEW.department_code,
    'MANAGER',
    NEW.starts_on,
    NEW.ends_on,
    NEW.is_void,
    NEW.recorded_by_action_id,
    NEW.recorded_at
  FROM employment_period_versions AS employment
  WHERE employment.employee_id = NEW.employee_id
    AND employment.is_void = 0
    AND employment.revision = (
      SELECT max(latest.revision)
      FROM employment_period_versions AS latest
      WHERE latest.period_id = employment.period_id
    )
    AND employment.starts_on <= NEW.starts_on
    AND (employment.ends_on IS NULL OR (NEW.ends_on IS NOT NULL AND NEW.ends_on <= employment.ends_on))
  ORDER BY employment.starts_on DESC, employment.period_id
  LIMIT 1;
END;

CREATE TRIGGER employee_status_period_versions_no_delete
BEFORE DELETE ON employee_status_period_versions
BEGIN
  SELECT RAISE(ABORT, 'employee_status_period_versions is append-only');
END;

CREATE TRIGGER employee_status_period_versions_no_update
BEFORE UPDATE ON employee_status_period_versions
BEGIN
  SELECT RAISE(ABORT, 'employee_status_period_versions is append-only');
END;

CREATE TRIGGER employment_period_versions_no_delete
BEFORE DELETE ON employment_period_versions
BEGIN
  SELECT RAISE(ABORT, 'employment_period_versions is append-only');
END;

CREATE TRIGGER employment_period_versions_no_update
BEFORE UPDATE ON employment_period_versions
BEGIN
  SELECT RAISE(ABORT, 'employment_period_versions is append-only');
END;

CREATE TRIGGER org_assignment_period_versions_no_delete
BEFORE DELETE ON "employee_org_assignment_period_versions"
BEGIN
  SELECT RAISE(ABORT, 'org_assignment_period_versions is append-only');
END;

CREATE TRIGGER org_assignment_period_versions_no_update
BEFORE UPDATE ON "employee_org_assignment_period_versions"
BEGIN
  SELECT RAISE(ABORT, 'org_assignment_period_versions is append-only');
END;

CREATE TRIGGER org_responsibility_period_versions_no_delete
BEFORE DELETE ON "employee_org_responsibility_period_versions"
BEGIN
  SELECT RAISE(ABORT, 'org_responsibility_period_versions is append-only');
END;

CREATE TRIGGER org_responsibility_period_versions_no_update
BEFORE UPDATE ON "employee_org_responsibility_period_versions"
BEGIN
  SELECT RAISE(ABORT, 'org_responsibility_period_versions is append-only');
END;

CREATE TRIGGER organization_assignment_period_versions_guard
BEFORE INSERT ON organization_assignment_period_versions
BEGIN
  SELECT RAISE(ABORT, 'organization change operation is missing or stale')
  WHERE NOT EXISTS (
    SELECT 1
    FROM organization_change_operations AS operation
    JOIN organization_lifecycle_states AS state ON state.id = 1
    WHERE operation.id = NEW.recorded_by_action_id
      AND operation.status = 'PENDING'
      AND operation.applied_count < operation.change_count
      AND state.revision = operation.expected_revision + operation.applied_count
  );

  SELECT RAISE(ABORT, 'organization assignment revision is not sequential')
  WHERE NEW.revision != coalesce(
    (
      SELECT max(revision)
      FROM organization_assignment_period_versions
      WHERE period_id = NEW.period_id
    ),
    0
  ) + 1;

  SELECT RAISE(ABORT, 'organization assignment owner is immutable')
  WHERE EXISTS (
    SELECT 1 FROM organization_assignment_period_versions AS previous
    WHERE previous.period_id = NEW.period_id
      AND (
        previous.employment_id != NEW.employment_id
        OR previous.employee_id != NEW.employee_id
        OR previous.organization_unit_id != NEW.organization_unit_id
        OR previous.assignment_type != NEW.assignment_type
      )
  );

  SELECT RAISE(ABORT, 'organization assignment employment mismatch')
  WHERE NEW.is_void = 0 AND NOT EXISTS (
    SELECT 1 FROM employment_period_versions AS employment
    WHERE 'employment:' || employment.period_id = NEW.employment_id
      AND 'employee:' || employment.employee_id = NEW.employee_id
      AND employment.is_void = 0
      AND employment.revision = (
        SELECT max(latest.revision)
        FROM employment_period_versions AS latest
        WHERE latest.period_id = employment.period_id
      )
      AND employment.starts_on <= NEW.starts_on
      AND (
        employment.ends_on IS NULL
        OR (NEW.ends_on IS NOT NULL AND NEW.ends_on <= employment.ends_on)
      )
  );

  SELECT RAISE(ABORT, 'organization assignment unit is not active')
  WHERE NEW.is_void = 0 AND NOT EXISTS (
    SELECT 1 FROM organization_unit_period_versions AS unit
    WHERE unit.organization_unit_id = NEW.organization_unit_id
      AND unit.is_void = 0
      AND unit.revision = (
        SELECT max(latest.revision)
        FROM organization_unit_period_versions AS latest
        WHERE latest.period_id = unit.period_id
      )
      AND unit.starts_on <= NEW.starts_on
      AND (
        unit.ends_on IS NULL
        OR (NEW.ends_on IS NOT NULL AND NEW.ends_on <= unit.ends_on)
      )
  );

  SELECT RAISE(ABORT, 'organization assignment overlaps')
  WHERE NEW.is_void = 0 AND EXISTS (
    SELECT 1 FROM organization_assignment_period_versions AS current
    WHERE current.period_id != NEW.period_id
      AND current.employee_id = NEW.employee_id
      AND current.is_void = 0
      AND current.revision = (
        SELECT max(latest.revision)
        FROM organization_assignment_period_versions AS latest
        WHERE latest.period_id = current.period_id
      )
      AND (
        (current.assignment_type = 'PRIMARY' AND NEW.assignment_type = 'PRIMARY')
        OR (
          current.organization_unit_id = NEW.organization_unit_id
          AND current.assignment_type = NEW.assignment_type
        )
      )
      AND (current.ends_on IS NULL OR NEW.starts_on < current.ends_on)
      AND (NEW.ends_on IS NULL OR current.starts_on < NEW.ends_on)
  );

  SELECT RAISE(ABORT, 'organization assignment manager is not employed')
  WHERE NEW.is_void = 0
    AND NEW.manager_employee_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM employment_period_versions AS employment
      WHERE 'employee:' || employment.employee_id = NEW.manager_employee_id
        AND employment.is_void = 0
        AND employment.revision = (
          SELECT max(latest.revision)
          FROM employment_period_versions AS latest
          WHERE latest.period_id = employment.period_id
        )
        AND employment.starts_on <= NEW.starts_on
        AND (
          employment.ends_on IS NULL
          OR (NEW.ends_on IS NOT NULL AND NEW.ends_on <= employment.ends_on)
        )
    );
END;

CREATE TRIGGER organization_assignment_period_versions_immutable_delete
BEFORE DELETE ON organization_assignment_period_versions
BEGIN
  SELECT RAISE(ABORT, 'organization assignments are append only');
END;

CREATE TRIGGER organization_assignment_period_versions_immutable_update
BEFORE UPDATE ON organization_assignment_period_versions
BEGIN
  SELECT RAISE(ABORT, 'organization assignments are append only');
END;

CREATE TRIGGER organization_assignment_period_versions_revision_state
AFTER INSERT ON organization_assignment_period_versions
BEGIN
  UPDATE organization_change_operations
  SET applied_count = applied_count + 1
  WHERE id = NEW.recorded_by_action_id;

  UPDATE organization_lifecycle_states
  SET revision = revision + 1, updated_at = max(updated_at, NEW.recorded_at)
  WHERE id = 1;
END;

CREATE TRIGGER organization_change_operations_command_immutable
BEFORE UPDATE OF request_fingerprint, actor_account_id, reason, evidence_references_json
ON organization_change_operations
BEGIN
  SELECT RAISE(ABORT, 'organization change command is immutable');
END;

CREATE TRIGGER organization_change_operations_completed_count_immutable
BEFORE UPDATE OF applied_count ON organization_change_operations
WHEN OLD.status = 'COMPLETED'
BEGIN
  SELECT RAISE(ABORT, 'completed organization change operation is immutable');
END;

CREATE TRIGGER organization_change_operations_completion_guard
BEFORE UPDATE OF status ON organization_change_operations
BEGIN
  SELECT RAISE(ABORT, 'organization change operation is incomplete')
  WHERE OLD.status != 'PENDING'
    OR NEW.status != 'COMPLETED'
    OR NEW.applied_count != NEW.change_count
    OR NOT EXISTS (
      SELECT 1 FROM organization_lifecycle_states AS state
      WHERE state.id = 1 AND state.revision = NEW.resulting_revision
    );

  SELECT RAISE(ABORT, 'organization change leaves an orphan organization unit')
  WHERE EXISTS (
    SELECT 1 FROM organization_unit_period_versions AS child
    WHERE child.is_void = 0
      AND child.parent_organization_unit_id IS NOT NULL
      AND child.revision = (
        SELECT max(latest.revision)
        FROM organization_unit_period_versions AS latest
        WHERE latest.period_id = child.period_id
      )
      AND NOT EXISTS (
        SELECT 1 FROM organization_unit_period_versions AS parent
        WHERE parent.organization_unit_id = child.parent_organization_unit_id
          AND parent.is_void = 0
          AND parent.revision = (
            SELECT max(latest.revision)
            FROM organization_unit_period_versions AS latest
            WHERE latest.period_id = parent.period_id
          )
          AND parent.starts_on <= child.starts_on
          AND (
            parent.ends_on IS NULL
            OR (child.ends_on IS NOT NULL AND child.ends_on <= parent.ends_on)
          )
      )
  );

  SELECT RAISE(ABORT, 'organization change leaves an orphan assignment')
  WHERE EXISTS (
    SELECT 1 FROM organization_assignment_period_versions AS assignment
    WHERE assignment.is_void = 0
      AND assignment.revision = (
        SELECT max(latest.revision)
        FROM organization_assignment_period_versions AS latest
        WHERE latest.period_id = assignment.period_id
      )
      AND (
        NOT EXISTS (
          SELECT 1 FROM employment_period_versions AS employment
          WHERE 'employment:' || employment.period_id = assignment.employment_id
            AND 'employee:' || employment.employee_id = assignment.employee_id
            AND employment.is_void = 0
            AND employment.revision = (
              SELECT max(latest.revision)
              FROM employment_period_versions AS latest
              WHERE latest.period_id = employment.period_id
            )
            AND employment.starts_on <= assignment.starts_on
            AND (
              employment.ends_on IS NULL
              OR (
                assignment.ends_on IS NOT NULL
                AND assignment.ends_on <= employment.ends_on
              )
            )
        )
        OR NOT EXISTS (
          SELECT 1 FROM organization_unit_period_versions AS unit
          WHERE unit.organization_unit_id = assignment.organization_unit_id
            AND unit.is_void = 0
            AND unit.revision = (
              SELECT max(latest.revision)
              FROM organization_unit_period_versions AS latest
              WHERE latest.period_id = unit.period_id
            )
            AND unit.starts_on <= assignment.starts_on
            AND (
              unit.ends_on IS NULL
              OR (
                assignment.ends_on IS NOT NULL
                AND assignment.ends_on <= unit.ends_on
              )
            )
        )
      )
  );

  SELECT RAISE(ABORT, 'organization change leaves an orphan responsibility')
  WHERE EXISTS (
    SELECT 1 FROM organization_responsibility_period_versions AS responsibility
    WHERE responsibility.is_void = 0
      AND responsibility.revision = (
        SELECT max(latest.revision)
        FROM organization_responsibility_period_versions AS latest
        WHERE latest.period_id = responsibility.period_id
      )
      AND NOT EXISTS (
        SELECT 1 FROM organization_assignment_period_versions AS assignment
        WHERE assignment.employment_id = responsibility.employment_id
          AND assignment.employee_id = responsibility.employee_id
          AND assignment.organization_unit_id = responsibility.organization_unit_id
          AND assignment.is_void = 0
          AND assignment.revision = (
            SELECT max(latest.revision)
            FROM organization_assignment_period_versions AS latest
            WHERE latest.period_id = assignment.period_id
          )
          AND assignment.starts_on <= responsibility.starts_on
          AND (
            assignment.ends_on IS NULL
            OR (
              responsibility.ends_on IS NOT NULL
              AND responsibility.ends_on <= assignment.ends_on
            )
          )
      )
  );
END;

CREATE TRIGGER organization_change_operations_immutable
BEFORE UPDATE OF id, expected_revision, change_count, resulting_revision, recorded_at
ON organization_change_operations
BEGIN
  SELECT RAISE(ABORT, 'organization change operation is immutable');
END;

CREATE TRIGGER organization_change_operations_immutable_delete
BEFORE DELETE ON organization_change_operations
BEGIN
  SELECT RAISE(ABORT, 'organization change operations are append only');
END;

CREATE TRIGGER organization_change_operations_insert_guard
BEFORE INSERT ON organization_change_operations
BEGIN
  SELECT RAISE(ABORT, 'organization revision conflict')
  WHERE NEW.applied_count != 0
    OR NEW.status != 'PENDING'
    OR NOT EXISTS (
      SELECT 1 FROM organization_lifecycle_states AS state
      WHERE state.id = 1 AND state.revision = NEW.expected_revision
    );
END;

CREATE TRIGGER organization_responsibility_period_versions_guard
BEFORE INSERT ON organization_responsibility_period_versions
BEGIN
  SELECT RAISE(ABORT, 'organization change operation is missing or stale')
  WHERE NOT EXISTS (
    SELECT 1
    FROM organization_change_operations AS operation
    JOIN organization_lifecycle_states AS state ON state.id = 1
    WHERE operation.id = NEW.recorded_by_action_id
      AND operation.status = 'PENDING'
      AND operation.applied_count < operation.change_count
      AND state.revision = operation.expected_revision + operation.applied_count
  );

  SELECT RAISE(ABORT, 'organization responsibility revision is not sequential')
  WHERE NEW.revision != coalesce(
    (
      SELECT max(revision)
      FROM organization_responsibility_period_versions
      WHERE period_id = NEW.period_id
    ),
    0
  ) + 1;

  SELECT RAISE(ABORT, 'organization responsibility owner is immutable')
  WHERE EXISTS (
    SELECT 1 FROM organization_responsibility_period_versions AS previous
    WHERE previous.period_id = NEW.period_id
      AND (
        previous.employment_id != NEW.employment_id
        OR previous.employee_id != NEW.employee_id
        OR previous.organization_unit_id != NEW.organization_unit_id
        OR previous.responsibility_type != NEW.responsibility_type
      )
  );

  SELECT RAISE(ABORT, 'organization responsibility employment mismatch')
  WHERE NEW.is_void = 0 AND NOT EXISTS (
    SELECT 1 FROM employment_period_versions AS employment
    WHERE 'employment:' || employment.period_id = NEW.employment_id
      AND 'employee:' || employment.employee_id = NEW.employee_id
      AND employment.is_void = 0
      AND employment.revision = (
        SELECT max(latest.revision)
        FROM employment_period_versions AS latest
        WHERE latest.period_id = employment.period_id
      )
      AND employment.starts_on <= NEW.starts_on
      AND (
        employment.ends_on IS NULL
        OR (NEW.ends_on IS NOT NULL AND NEW.ends_on <= employment.ends_on)
      )
  );

  SELECT RAISE(ABORT, 'organization responsibility unit is not active')
  WHERE NEW.is_void = 0 AND NOT EXISTS (
    SELECT 1 FROM organization_unit_period_versions AS unit
    WHERE unit.organization_unit_id = NEW.organization_unit_id
      AND unit.is_void = 0
      AND unit.revision = (
        SELECT max(latest.revision)
        FROM organization_unit_period_versions AS latest
        WHERE latest.period_id = unit.period_id
      )
      AND unit.starts_on <= NEW.starts_on
      AND (
        unit.ends_on IS NULL
        OR (NEW.ends_on IS NOT NULL AND NEW.ends_on <= unit.ends_on)
      )
  );

  SELECT RAISE(ABORT, 'organization responsibility requires matching assignment')
  WHERE NEW.is_void = 0 AND NOT EXISTS (
    SELECT 1 FROM organization_assignment_period_versions AS assignment
    WHERE assignment.employment_id = NEW.employment_id
      AND assignment.employee_id = NEW.employee_id
      AND assignment.organization_unit_id = NEW.organization_unit_id
      AND assignment.is_void = 0
      AND assignment.revision = (
        SELECT max(latest.revision)
        FROM organization_assignment_period_versions AS latest
        WHERE latest.period_id = assignment.period_id
      )
      AND assignment.starts_on <= NEW.starts_on
      AND (
        assignment.ends_on IS NULL
        OR (NEW.ends_on IS NOT NULL AND NEW.ends_on <= assignment.ends_on)
      )
  );

  SELECT RAISE(ABORT, 'organization responsibility overlaps')
  WHERE NEW.is_void = 0 AND EXISTS (
    SELECT 1 FROM organization_responsibility_period_versions AS current
    WHERE current.period_id != NEW.period_id
      AND current.employee_id = NEW.employee_id
      AND current.organization_unit_id = NEW.organization_unit_id
      AND current.responsibility_type = NEW.responsibility_type
      AND current.is_void = 0
      AND current.revision = (
        SELECT max(latest.revision)
        FROM organization_responsibility_period_versions AS latest
        WHERE latest.period_id = current.period_id
      )
      AND (current.ends_on IS NULL OR NEW.starts_on < current.ends_on)
      AND (NEW.ends_on IS NULL OR current.starts_on < NEW.ends_on)
  );
END;

CREATE TRIGGER organization_responsibility_period_versions_immutable_delete
BEFORE DELETE ON organization_responsibility_period_versions
BEGIN
  SELECT RAISE(ABORT, 'organization responsibilities are append only');
END;

CREATE TRIGGER organization_responsibility_period_versions_immutable_update
BEFORE UPDATE ON organization_responsibility_period_versions
BEGIN
  SELECT RAISE(ABORT, 'organization responsibilities are append only');
END;

CREATE TRIGGER organization_responsibility_period_versions_revision_state
AFTER INSERT ON organization_responsibility_period_versions
BEGIN
  UPDATE organization_change_operations
  SET applied_count = applied_count + 1
  WHERE id = NEW.recorded_by_action_id;

  UPDATE organization_lifecycle_states
  SET revision = revision + 1, updated_at = max(updated_at, NEW.recorded_at)
  WHERE id = 1;
END;

CREATE TRIGGER organization_unit_period_versions_immutable_delete
BEFORE DELETE ON organization_unit_period_versions
BEGIN
  SELECT RAISE(ABORT, 'organization unit periods are append only');
END;

CREATE TRIGGER organization_unit_period_versions_immutable_update
BEFORE UPDATE ON organization_unit_period_versions
BEGIN
  SELECT RAISE(ABORT, 'organization unit periods are append only');
END;

CREATE TRIGGER organization_unit_period_versions_revision_guard
BEFORE INSERT ON organization_unit_period_versions
BEGIN
  SELECT RAISE(ABORT, 'organization change operation is missing or stale')
  WHERE NOT EXISTS (
    SELECT 1
    FROM organization_change_operations AS operation
    JOIN organization_lifecycle_states AS state ON state.id = 1
    WHERE operation.id = NEW.recorded_by_action_id
      AND operation.status = 'PENDING'
      AND operation.applied_count < operation.change_count
      AND state.revision = operation.expected_revision + operation.applied_count
  );

  SELECT RAISE(ABORT, 'organization unit revision is not sequential')
  WHERE NEW.revision != coalesce(
    (SELECT max(revision) FROM organization_unit_period_versions WHERE period_id = NEW.period_id),
    0
  ) + 1;

  SELECT RAISE(ABORT, 'organization unit period owner is immutable')
  WHERE EXISTS (
    SELECT 1 FROM organization_unit_period_versions AS previous
    WHERE previous.period_id = NEW.period_id
      AND previous.organization_unit_id != NEW.organization_unit_id
  );

  SELECT RAISE(ABORT, 'organization root requires canonical parent')
  WHERE (NEW.kind = 'COMPANY' AND NEW.parent_organization_unit_id IS NOT NULL)
     OR (NEW.kind != 'COMPANY' AND NEW.parent_organization_unit_id IS NULL);

  SELECT RAISE(ABORT, 'organization unit period overlaps')
  WHERE NEW.is_void = 0 AND EXISTS (
    SELECT 1 FROM organization_unit_period_versions AS current
    WHERE current.period_id != NEW.period_id
      AND current.organization_unit_id = NEW.organization_unit_id
      AND current.is_void = 0
      AND current.revision = (
        SELECT max(latest.revision)
        FROM organization_unit_period_versions AS latest
        WHERE latest.period_id = current.period_id
      )
      AND (current.ends_on IS NULL OR NEW.starts_on < current.ends_on)
      AND (NEW.ends_on IS NULL OR current.starts_on < NEW.ends_on)
  );

  SELECT RAISE(ABORT, 'organization unit code overlaps')
  WHERE NEW.is_void = 0 AND EXISTS (
    SELECT 1 FROM organization_unit_period_versions AS current
    WHERE current.period_id != NEW.period_id
      AND current.organization_unit_id != NEW.organization_unit_id
      AND current.code = NEW.code
      AND current.is_void = 0
      AND current.revision = (
        SELECT max(latest.revision)
        FROM organization_unit_period_versions AS latest
        WHERE latest.period_id = current.period_id
      )
      AND (current.ends_on IS NULL OR NEW.starts_on < current.ends_on)
      AND (NEW.ends_on IS NULL OR current.starts_on < NEW.ends_on)
  );

  SELECT RAISE(ABORT, 'company root period overlaps')
  WHERE NEW.is_void = 0 AND NEW.kind = 'COMPANY' AND EXISTS (
    SELECT 1 FROM organization_unit_period_versions AS current
    WHERE current.period_id != NEW.period_id
      AND current.kind = 'COMPANY'
      AND current.is_void = 0
      AND current.revision = (
        SELECT max(latest.revision)
        FROM organization_unit_period_versions AS latest
        WHERE latest.period_id = current.period_id
      )
      AND (current.ends_on IS NULL OR NEW.starts_on < current.ends_on)
      AND (NEW.ends_on IS NULL OR current.starts_on < NEW.ends_on)
  );
END;

CREATE TRIGGER organization_unit_period_versions_revision_state
AFTER INSERT ON organization_unit_period_versions
BEGIN
  UPDATE organization_change_operations
  SET applied_count = applied_count + 1
  WHERE id = NEW.recorded_by_action_id;

  UPDATE organization_lifecycle_states
  SET revision = revision + 1, updated_at = max(updated_at, NEW.recorded_at)
  WHERE id = 1;
END;

CREATE TRIGGER organization_units_immutable_delete
BEFORE DELETE ON organization_units
BEGIN
  SELECT RAISE(ABORT, 'organization unit identity is append only');
END;

CREATE TRIGGER organization_units_immutable_update
BEFORE UPDATE ON organization_units
BEGIN
  SELECT RAISE(ABORT, 'organization unit identity is immutable');
END;

CREATE TRIGGER personnel_action_requests_immutable_proposal
BEFORE UPDATE ON personnel_action_requests
WHEN
  NEW.id IS NOT OLD.id
  OR NEW.application_id IS NOT OLD.application_id
  OR NEW.system_proposal_series_id IS NOT OLD.system_proposal_series_id
  OR NEW.kind IS NOT OLD.kind
  OR NEW.payload_json IS NOT OLD.payload_json
  OR NEW.payload_fingerprint IS NOT OLD.payload_fingerprint
  OR NEW.requested_by_employee_id IS NOT OLD.requested_by_employee_id
  OR NEW.base_employee_revision IS NOT OLD.base_employee_revision
  OR NEW.base_organization_revision IS NOT OLD.base_organization_revision
  OR NEW.created_at IS NOT OLD.created_at
  OR NEW.subject_snapshot_json IS NOT OLD.subject_snapshot_json
  OR NEW.target_department_code IS NOT OLD.target_department_code
  OR OLD.withdrawn_at IS NOT NULL
  OR OLD.applied_action_id IS NOT NULL
  OR (NEW.withdrawn_at IS NOT NULL AND NEW.applied_action_id IS NOT NULL)
BEGIN
  SELECT RAISE(ABORT, 'personnel action request proposal is immutable');
END;

CREATE TRIGGER personnel_action_requests_system_proposal_insert
BEFORE INSERT ON personnel_action_requests
WHEN
  NEW.system_proposal_series_id IS NULL
  OR NEW.payload_fingerprint IS NULL
  OR NOT EXISTS (
    SELECT 1
    FROM system_proposal_numbers AS number
    JOIN system_proposal_series AS series ON series.id = number.series_id
    WHERE number.number = NEW.application_id
      AND number.series_id = NEW.system_proposal_series_id
      AND series.procedure_key = 'personnel_action_request'
  )
  OR NOT EXISTS (
    SELECT 1
    FROM system_proposals AS proposal
    WHERE proposal.series_id = NEW.system_proposal_series_id
      AND proposal.body_json = NEW.payload_json
  )
BEGIN
  SELECT RAISE(ABORT, 'personnel action requires matching System proposal');
END;

CREATE TRIGGER personnel_actions_no_delete
BEFORE DELETE ON personnel_actions
BEGIN
  SELECT RAISE(ABORT, 'personnel_actions is append-only');
END;

CREATE TRIGGER personnel_actions_no_update
BEFORE UPDATE ON personnel_actions
BEGIN
  SELECT RAISE(ABORT, 'personnel_actions is append-only');
END;

INSERT INTO "governance_org_roles" ("code", "name", "description", "assignment_mode", "cardinality", "created_at", "updated_at") VALUES ('board', '取締役会', '重要規程の制定・改廃を審議する機関', 'manual', 'many', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');
INSERT INTO "governance_org_roles" ("code", "name", "description", "assignment_mode", "cardinality", "created_at", "updated_at") VALUES ('representative-director', '代表取締役', '会社を代表して業務執行を統括する責任', 'manual', 'one', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');
INSERT INTO "governance_org_roles" ("code", "name", "description", "assignment_mode", "cardinality", "created_at", "updated_at") VALUES ('executive-officer', '担当役員', '担当領域の業務執行を統括する責任', 'manual', 'many', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');
INSERT INTO "governance_org_roles" ("code", "name", "description", "assignment_mode", "cardinality", "created_at", "updated_at") VALUES ('department-manager', '部門長', '各部門の業務執行を管理する責任', 'department_manager', 'per_department', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');
INSERT INTO "governance_org_roles" ("code", "name", "description", "assignment_mode", "cardinality", "created_at", "updated_at") VALUES ('section-manager', '課長', '各課の業務執行を管理する責任', 'manual', 'many', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');
INSERT INTO "governance_org_roles" ("code", "name", "description", "assignment_mode", "cardinality", "created_at", "updated_at") VALUES ('management-meeting', '経営会議', '重要な業務執行事項を審議する機関', 'manual', 'many', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');
INSERT INTO "governance_org_roles" ("code", "name", "description", "assignment_mode", "cardinality", "created_at", "updated_at") VALUES ('internal-control-committee', '内部統制委員会', '規程間の齟齬と内部統制上の論点を調整する機関', 'manual', 'many', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');
INSERT INTO "governance_org_roles" ("code", "name", "description", "assignment_mode", "cardinality", "created_at", "updated_at") VALUES ('ciso', '最高情報セキュリティ責任者', '情報セキュリティ施策を統括する責任', 'manual', 'one', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');
INSERT INTO "governance_org_roles" ("code", "name", "description", "assignment_mode", "cardinality", "created_at", "updated_at") VALUES ('department-information-security-manager', '部門情報セキュリティ管理者', '各部門長が担う情報セキュリティ管理責任', 'department_manager', 'per_department', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');
INSERT INTO "governance_org_roles" ("code", "name", "description", "assignment_mode", "cardinality", "created_at", "updated_at") VALUES ('privacy-manager', '個人情報保護管理者', '個人情報の適正な管理を統括する責任', 'manual', 'one', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');
INSERT INTO "governance_org_roles" ("code", "name", "description", "assignment_mode", "cardinality", "created_at", "updated_at") VALUES ('privacy-auditor', '個人情報保護監査責任者', '個人情報の取扱いを独立して監査する責任', 'manual', 'one', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');
INSERT INTO "governance_org_roles" ("code", "name", "description", "assignment_mode", "cardinality", "created_at", "updated_at") VALUES ('internal-auditor', '内部監査責任者', '規程及び統制の遵守状況を監査する責任', 'manual', 'many', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');

INSERT INTO "governance_capabilities" ("code", "name", "description", "owner_org_role_code", "status", "created_at", "updated_at") VALUES ('corporate-governance', '会社統治を管理する', '決裁権限、委任、会議体及び内部統制を管理する', 'representative-director', 'active', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');
INSERT INTO "governance_capabilities" ("code", "name", "description", "owner_org_role_code", "status", "created_at", "updated_at") VALUES ('information-security', '情報セキュリティを管理する', '情報資産、アクセス、インシデント及び教育を管理する', 'ciso', 'active', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');
INSERT INTO "governance_capabilities" ("code", "name", "description", "owner_org_role_code", "status", "created_at", "updated_at") VALUES ('privacy-protection', '個人情報を保護する', '個人情報の取得、利用、保管、提供及び事故対応を管理する', 'privacy-manager', 'active', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');
INSERT INTO "governance_capabilities" ("code", "name", "description", "owner_org_role_code", "status", "created_at", "updated_at") VALUES ('policy-management', '規程を管理する', '規程の原本、版、公開、確認及び見直しを管理する', 'internal-auditor', 'active', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');


INSERT INTO company_organizations (
  id, revision, created_at, updated_at, name, representative_name
) VALUES ('organization:default', 0, 0, 0, '', '');

INSERT INTO organization_lifecycle_states (id, revision, updated_at)
VALUES (1, 0, 0);

INSERT INTO organization_change_operations (
  id, expected_revision, change_count, applied_count, resulting_revision, status,
  recorded_at, request_fingerprint, actor_account_id, reason, evidence_references_json
) VALUES (
  'initialization:organization:default', 0, 1, 0, 1, 'PENDING', 0,
  '0000000000000000000000000000000000000000000000000000000000000000',
  'system:initialization', 'Initialize organization root', '[]'
);

INSERT INTO organization_units (id, created_at)
VALUES ('company:root', 0);

INSERT INTO organization_unit_period_versions (
  period_id, revision, organization_unit_id, code, official_name, kind,
  parent_organization_unit_id, starts_on, ends_on, is_void,
  recorded_by_action_id, recorded_at
) VALUES (
  'company:root:initial', 1, 'company:root', 'COMPANY', 'Company', 'COMPANY',
  NULL, '1970-01-01', NULL, 0, 'initialization:organization:default', 0
);

UPDATE organization_change_operations
SET status = 'COMPLETED'
WHERE id = 'initialization:organization:default';
