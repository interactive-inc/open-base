-- System と Company の新規インストール用基盤。
PRAGMA defer_foreign_keys = ON;
CREATE TABLE company_account_employee_links (
  account_id TEXT PRIMARY KEY NOT NULL
    REFERENCES system_accounts(id) ON DELETE RESTRICT,
  employee_id TEXT NOT NULL
    REFERENCES company_employees(id) ON DELETE RESTRICT,
  CHECK (length(account_id) = 36 AND account_id NOT GLOB '*[^0-9a-f-]*' AND substr(account_id, 9, 1) = '-' AND substr(account_id, 14, 1) = '-' AND substr(account_id, 19, 1) = '-' AND substr(account_id, 24, 1) = '-' AND length(replace(account_id, '-', '')) = 32 AND substr(account_id, 15, 1) GLOB '[1-8]' AND substr(account_id, 20, 1) GLOB '[89ab]')
);

CREATE TABLE company_account_employee_resource_bindings (
  resource_id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL DEFAULT 'ad4f6cb1-774b-43ae-950f-80e9bc67c66d' CHECK (organization_id = 'ad4f6cb1-774b-43ae-950f-80e9bc67c66d'),
  resource_type TEXT NOT NULL DEFAULT 'account-employee-link' CHECK (resource_type = 'account-employee-link'),
  account_id TEXT NOT NULL UNIQUE REFERENCES system_accounts(id) ON DELETE RESTRICT,
  employee_id TEXT NOT NULL UNIQUE REFERENCES company_employees(id) ON DELETE RESTRICT,
  recorded_at INTEGER NOT NULL CHECK (recorded_at >= 0),
  FOREIGN KEY (organization_id, resource_type, resource_id)
    REFERENCES company_resource_heads(organization_id, resource_type, resource_id) ON DELETE RESTRICT,
  CHECK (length(resource_id) = 36 AND resource_id NOT GLOB '*[^0-9a-f-]*' AND substr(resource_id, 9, 1) = '-' AND substr(resource_id, 14, 1) = '-' AND substr(resource_id, 19, 1) = '-' AND substr(resource_id, 24, 1) = '-' AND length(replace(resource_id, '-', '')) = 32 AND substr(resource_id, 15, 1) GLOB '[1-8]' AND substr(resource_id, 20, 1) GLOB '[89ab]')
);

CREATE TABLE company_account_profiles (
  -- 旧来の主キーで行を足す書込みが残るため、主キーは列の既定値でも採番する。
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  organization_id TEXT NOT NULL REFERENCES company_organizations(id) ON DELETE CASCADE ON UPDATE CASCADE,
  account_id TEXT NOT NULL REFERENCES system_accounts(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL CHECK (
    length(display_name) BETWEEN 1 AND 200
    AND trim(display_name) = display_name
    AND instr(display_name, char(0)) = 0
  ),
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  updated_at INTEGER NOT NULL CHECK (updated_at >= created_at),
  UNIQUE (organization_id, account_id),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);

CREATE TABLE company_assignment_period_bindings (
  period_id TEXT PRIMARY KEY NOT NULL,
  resource_id TEXT NOT NULL REFERENCES company_assignment_resource_bindings(resource_id) ON DELETE RESTRICT,
  period_revision INTEGER NOT NULL CHECK (period_revision >= 1),
  source_revision INTEGER NOT NULL CHECK (source_revision >= 1),
  FOREIGN KEY (period_id, period_revision) REFERENCES company_organization_assignment_period_versions(period_id, revision) ON DELETE RESTRICT,
  CHECK (length(period_id) = 36 AND period_id NOT GLOB '*[^0-9a-f-]*' AND substr(period_id, 9, 1) = '-' AND substr(period_id, 14, 1) = '-' AND substr(period_id, 19, 1) = '-' AND substr(period_id, 24, 1) = '-' AND length(replace(period_id, '-', '')) = 32 AND substr(period_id, 15, 1) GLOB '[1-8]' AND substr(period_id, 20, 1) GLOB '[89ab]')
);

CREATE TABLE company_assignment_resource_adoptions (
  -- 旧来の主キーで行を足す書込みが残るため、主キーは列の既定値でも採番する。
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  command_id TEXT NOT NULL UNIQUE CHECK (length(command_id) BETWEEN 1 AND 200),
  employee_id TEXT NOT NULL REFERENCES company_employees(id) ON DELETE RESTRICT,
  fingerprint TEXT NOT NULL CHECK (length(fingerprint) = 64),
  actor_account_id TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (length(reason) BETWEEN 1 AND 1000),
  expected_revision INTEGER NOT NULL CHECK (expected_revision >= 0),
  organization_revision INTEGER NOT NULL CHECK (organization_revision > expected_revision),
  observed_on TEXT NOT NULL,
  adopted_periods INTEGER NOT NULL CHECK (adopted_periods BETWEEN 1 AND 1000),
  snapshot_digest TEXT NOT NULL CHECK (length(snapshot_digest) = 64),
  source_json TEXT NOT NULL CHECK (json_valid(source_json)),
  recorded_at INTEGER NOT NULL CHECK (recorded_at >= 0), mappings_json TEXT CHECK (mappings_json IS NULL OR (json_valid(mappings_json) AND json_type(mappings_json) = 'array')),
  UNIQUE (employee_id, snapshot_digest),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);

CREATE TABLE company_assignment_resource_bindings (
  resource_id TEXT PRIMARY KEY NOT NULL CHECK (length(resource_id) BETWEEN 1 AND 255),
  organization_id TEXT NOT NULL REFERENCES company_organizations(id) ON DELETE RESTRICT CHECK (organization_id = 'ad4f6cb1-774b-43ae-950f-80e9bc67c66d'),
  employee_id TEXT NOT NULL REFERENCES company_employees(id) ON DELETE RESTRICT,
  resource_revision INTEGER NOT NULL CHECK (resource_revision >= 1),
  recorded_at INTEGER NOT NULL CHECK (recorded_at >= 0),
  CHECK (length(resource_id) = 36 AND resource_id NOT GLOB '*[^0-9a-f-]*' AND substr(resource_id, 9, 1) = '-' AND substr(resource_id, 14, 1) = '-' AND substr(resource_id, 19, 1) = '-' AND substr(resource_id, 24, 1) = '-' AND length(replace(resource_id, '-', '')) = 32 AND substr(resource_id, 15, 1) GLOB '[1-8]' AND substr(resource_id, 20, 1) GLOB '[89ab]')
);

CREATE TABLE company_audit_append_guard (
  audit_id TEXT PRIMARY KEY NOT NULL,
  event_id TEXT NOT NULL UNIQUE,
  CHECK (length(audit_id) = 36 AND audit_id NOT GLOB '*[^0-9a-f-]*' AND substr(audit_id, 9, 1) = '-' AND substr(audit_id, 14, 1) = '-' AND substr(audit_id, 19, 1) = '-' AND substr(audit_id, 24, 1) = '-' AND length(replace(audit_id, '-', '')) = 32 AND substr(audit_id, 15, 1) GLOB '[1-8]' AND substr(audit_id, 20, 1) GLOB '[89ab]')
) WITHOUT ROWID;

CREATE TABLE company_audit_batch_decisions (
  decision_id TEXT PRIMARY KEY NOT NULL,
  decision_value TEXT NOT NULL,
  CHECK (length(decision_value) BETWEEN 1 AND 64),
  CHECK (length(decision_id) = 36 AND decision_id NOT GLOB '*[^0-9a-f-]*' AND substr(decision_id, 9, 1) = '-' AND substr(decision_id, 14, 1) = '-' AND substr(decision_id, 19, 1) = '-' AND substr(decision_id, 24, 1) = '-' AND length(replace(decision_id, '-', '')) = 32 AND substr(decision_id, 15, 1) GLOB '[1-8]' AND substr(decision_id, 20, 1) GLOB '[89ab]')
) WITHOUT ROWID;

CREATE TABLE company_audit_event_appends (
  staging_id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
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
  CHECK (actor_account_id IS NULL OR length(actor_account_id) BETWEEN 1 AND 255),
  CHECK (length(staging_id) = 36 AND staging_id NOT GLOB '*[^0-9a-f-]*' AND substr(staging_id, 9, 1) = '-' AND substr(staging_id, 14, 1) = '-' AND substr(staging_id, 19, 1) = '-' AND substr(staging_id, 24, 1) = '-' AND length(replace(staging_id, '-', '')) = 32 AND substr(staging_id, 15, 1) GLOB '[1-8]' AND substr(staging_id, 20, 1) GLOB '[89ab]')
);

CREATE TABLE company_audit_event_employee_contexts (
  audit_event_id TEXT PRIMARY KEY NOT NULL,
  employee_id TEXT NOT NULL,
  CHECK (length(audit_event_id) = 36 AND audit_event_id NOT GLOB '*[^0-9a-f-]*' AND substr(audit_event_id, 9, 1) = '-' AND substr(audit_event_id, 14, 1) = '-' AND substr(audit_event_id, 19, 1) = '-' AND substr(audit_event_id, 24, 1) = '-' AND length(replace(audit_event_id, '-', '')) = 32 AND substr(audit_event_id, 15, 1) GLOB '[1-8]' AND substr(audit_event_id, 20, 1) GLOB '[89ab]')
);

CREATE TABLE company_audit_events (
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
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
  CHECK (actor_account_id IS NULL OR length(actor_account_id) BETWEEN 1 AND 255),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]'),
  CHECK (length(event_id) = 36 AND event_id NOT GLOB '*[^0-9a-f-]*' AND substr(event_id, 9, 1) = '-' AND substr(event_id, 14, 1) = '-' AND substr(event_id, 19, 1) = '-' AND substr(event_id, 24, 1) = '-' AND length(replace(event_id, '-', '')) = 32 AND substr(event_id, 15, 1) GLOB '[1-8]' AND substr(event_id, 20, 1) GLOB '[89ab]')
);

CREATE TABLE company_bootstrap_receipts (
  -- 旧来の主キーで行を足す書込みが残るため、主キーは列の既定値でも採番する。
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  command_id TEXT NOT NULL UNIQUE CHECK (length(command_id) BETWEEN 1 AND 200),
  organization_id TEXT NOT NULL UNIQUE REFERENCES company_organizations(id) CHECK (organization_id = 'ad4f6cb1-774b-43ae-950f-80e9bc67c66d'),
  actor_account_id TEXT NOT NULL REFERENCES system_accounts(id),
  fingerprint TEXT NOT NULL CHECK (length(fingerprint) = 64 AND fingerprint NOT GLOB '*[^0-9a-f]*'),
  employee_id TEXT NOT NULL REFERENCES company_employees(id),
  organization_revision INTEGER NOT NULL CHECK (organization_revision > 0),
  declaration_json TEXT NOT NULL CHECK (json_valid(declaration_json)),
  source_json TEXT NOT NULL CHECK (json_valid(source_json) AND length(CAST(source_json AS BLOB)) <= 750000),
  recorded_at INTEGER NOT NULL CHECK (recorded_at >= 0),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);

CREATE TABLE "company_calendar_days" (
  id TEXT PRIMARY KEY NOT NULL,
  calendar_date TEXT NOT NULL,
  kind TEXT NOT NULL,
  name TEXT,
  created_at TEXT NOT NULL,
  legacy_id TEXT UNIQUE,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);

CREATE TABLE company_command_receipts (
  -- 旧来の主キーで行を足す書込みが残るため、主キーは列の既定値でも採番する。
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  organization_id TEXT NOT NULL REFERENCES company_organizations(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  command_id TEXT NOT NULL,
  fingerprint TEXT NOT NULL CHECK (length(fingerprint) = 64),
  expected_revision INTEGER NOT NULL CHECK (expected_revision >= 0),
  organization_revision INTEGER NOT NULL CHECK (organization_revision = expected_revision + 1),
  recorded_at INTEGER NOT NULL CHECK (recorded_at >= 0),
  UNIQUE (organization_id, command_id),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);

CREATE TABLE company_definition_resource_adoptions (
  -- 旧来の主キーで行を足す書込みが残るため、主キーは列の既定値でも採番する。
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  organization_id TEXT NOT NULL DEFAULT 'ad4f6cb1-774b-43ae-950f-80e9bc67c66d' CHECK (organization_id = 'ad4f6cb1-774b-43ae-950f-80e9bc67c66d'),
  command_id TEXT NOT NULL,
  resource_type TEXT NOT NULL CHECK (resource_type IN ('grade', 'position')),
  definition_id INTEGER NOT NULL CHECK (definition_id > 0),
  resource_id TEXT NOT NULL,
  fingerprint TEXT NOT NULL CHECK (length(fingerprint) = 64),
  actor_account_id TEXT NOT NULL REFERENCES system_accounts(id) ON DELETE RESTRICT,
  reason TEXT NOT NULL CHECK (length(trim(reason)) BETWEEN 1 AND 1000),
  expected_revision INTEGER NOT NULL CHECK (expected_revision >= 0),
  organization_revision INTEGER NOT NULL CHECK (organization_revision = expected_revision + 1),
  observed_on TEXT NOT NULL CHECK (length(observed_on) = 10),
  snapshot_digest TEXT NOT NULL CHECK (length(snapshot_digest) = 64),
  source_json TEXT NOT NULL CHECK (json_valid(source_json) AND length(CAST(source_json AS BLOB)) <= 20000
    AND json_extract(source_json, '$.definition.type') IS resource_type
    AND json_extract(source_json, '$.definition.id') IS definition_id
    AND json_extract(source_json, '$.organizationRevision') IS expected_revision),
  recorded_at INTEGER NOT NULL CHECK (recorded_at >= 0),
  UNIQUE (organization_id, command_id),
  UNIQUE (resource_type, definition_id),
  UNIQUE (organization_id, resource_type, resource_id),
  FOREIGN KEY (organization_id, resource_type, resource_id)
    REFERENCES company_resource_heads(organization_id, resource_type, resource_id) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, command_id)
    REFERENCES company_command_receipts(organization_id, command_id) ON DELETE RESTRICT,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);

CREATE TABLE company_employee_lifecycle_revisions (
  employee_id TEXT PRIMARY KEY NOT NULL,
  revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  updated_at INTEGER NOT NULL,
  CHECK (length(employee_id) = 36 AND employee_id NOT GLOB '*[^0-9a-f-]*' AND substr(employee_id, 9, 1) = '-' AND substr(employee_id, 14, 1) = '-' AND substr(employee_id, 19, 1) = '-' AND substr(employee_id, 24, 1) = '-' AND length(replace(employee_id, '-', '')) = 32 AND substr(employee_id, 15, 1) GLOB '[1-8]' AND substr(employee_id, 20, 1) GLOB '[89ab]')
);

CREATE TABLE company_employee_resource_adoptions (
  -- 旧来の主キーで行を足す書込みが残るため、主キーは列の既定値でも採番する。
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  command_id TEXT NOT NULL UNIQUE CHECK (length(command_id) BETWEEN 1 AND 200),
  employee_id TEXT NOT NULL UNIQUE REFERENCES company_employees(id) ON DELETE RESTRICT,
  fingerprint TEXT NOT NULL CHECK (length(fingerprint) = 64 AND fingerprint NOT GLOB '*[^0-9a-f]*'),
  actor_account_id TEXT NOT NULL REFERENCES system_accounts(id) ON DELETE RESTRICT,
  reason TEXT NOT NULL CHECK (length(trim(reason)) BETWEEN 1 AND 1500),
  expected_revision INTEGER NOT NULL CHECK (expected_revision >= 0),
  organization_revision INTEGER NOT NULL CHECK (organization_revision > expected_revision AND organization_revision <= expected_revision + 100),
  observed_on TEXT NOT NULL CHECK (length(observed_on) = 10),
  snapshot_digest TEXT NOT NULL CHECK (length(snapshot_digest) = 64 AND snapshot_digest NOT GLOB '*[^0-9a-f]*'),
  source_json TEXT NOT NULL CHECK (json_valid(source_json) AND length(CAST(source_json AS BLOB)) <= 750000),
  recorded_at INTEGER NOT NULL CHECK (recorded_at >= 0),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);

CREATE TABLE company_employee_status_period_versions (
  -- 旧来の主キーで行を足す書込みが残るため、主キーは列の既定値でも採番する。
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
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
  UNIQUE (period_id, revision),
  CHECK (ends_on IS NULL OR starts_on < ends_on),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
) WITHOUT ROWID;

CREATE TABLE company_employees (
  id TEXT PRIMARY KEY NOT NULL,
  legacy_id TEXT UNIQUE,
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
    CHECK (updated_at >= created_at),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
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
    CHECK (updated_at >= created_at),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);

CREATE TABLE company_employment_period_versions (
  -- 旧来の主キーで行を足す書込みが残るため、主キーは列の既定値でも採番する。
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
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
  UNIQUE (period_id, revision),
  CHECK (ends_on IS NULL OR starts_on < ends_on),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
) WITHOUT ROWID;

CREATE TABLE company_employments (
  id TEXT PRIMARY KEY NOT NULL,
  legacy_id TEXT UNIQUE,
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
  CHECK (termination_date IS NULL OR hire_date <= termination_date),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);

CREATE TABLE company_external_identity_imports (
  -- 旧来の主キーで行を足す書込みが残るため、主キーは列の既定値でも採番する。
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  organization_id TEXT NOT NULL REFERENCES company_organizations(id) ON DELETE RESTRICT,
  command_id TEXT NOT NULL CHECK (length(command_id) BETWEEN 1 AND 200),
  fingerprint TEXT NOT NULL CHECK (length(fingerprint) = 64 AND fingerprint NOT GLOB '*[^0-9a-f]*'),
  actor_account_id TEXT NOT NULL REFERENCES system_accounts(id) ON DELETE RESTRICT,
  machine_credential_id TEXT NOT NULL REFERENCES system_machine_credentials(id) ON DELETE RESTRICT,
  reason TEXT NOT NULL CHECK (length(trim(reason)) BETWEEN 1 AND 2000),
  expected_revision INTEGER NOT NULL CHECK (expected_revision >= 0),
  organization_revision INTEGER NOT NULL CHECK (organization_revision = expected_revision + 1),
  result_json TEXT NOT NULL CHECK (json_valid(result_json)),
  recorded_at INTEGER NOT NULL CHECK (recorded_at >= 0),
  UNIQUE (organization_id, command_id),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);

CREATE TABLE company_external_identity_sources (
  identity_id TEXT PRIMARY KEY NOT NULL REFERENCES system_identity_bindings(id) ON DELETE RESTRICT,
  organization_id TEXT NOT NULL REFERENCES company_organizations(id) ON DELETE RESTRICT,
  source_revision INTEGER NOT NULL CHECK (source_revision > 0),
  source_digest TEXT NOT NULL CHECK (length(source_digest) = 64 AND source_digest NOT GLOB '*[^0-9a-f]*'),
  updated_at INTEGER NOT NULL CHECK (updated_at >= 0),
  CHECK (length(identity_id) = 36 AND identity_id NOT GLOB '*[^0-9a-f-]*' AND substr(identity_id, 9, 1) = '-' AND substr(identity_id, 14, 1) = '-' AND substr(identity_id, 19, 1) = '-' AND substr(identity_id, 24, 1) = '-' AND length(replace(identity_id, '-', '')) = 32 AND substr(identity_id, 15, 1) GLOB '[1-8]' AND substr(identity_id, 20, 1) GLOB '[89ab]')
);

CREATE TABLE company_grade_award_archives (
  -- 旧来の主キーで行を足す書込みが残るため、主キーは列の既定値でも採番する。
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  organization_id TEXT NOT NULL REFERENCES company_organizations(id) CHECK (organization_id = 'ad4f6cb1-774b-43ae-950f-80e9bc67c66d'),
  command_id TEXT NOT NULL,
  employee_id TEXT NOT NULL REFERENCES company_employees(id),
  fingerprint TEXT NOT NULL CHECK (length(fingerprint) = 64),
  actor_account_id TEXT NOT NULL REFERENCES system_accounts(id),
  reason TEXT NOT NULL CHECK (length(trim(reason)) BETWEEN 1 AND 2000),
  observed_on TEXT NOT NULL CHECK (length(observed_on) = 10),
  observed_company_revision INTEGER NOT NULL CHECK (observed_company_revision >= 0),
  snapshot_digest TEXT NOT NULL CHECK (length(snapshot_digest) = 64),
  source_json TEXT NOT NULL CHECK (json_valid(source_json)),
  recorded_at INTEGER NOT NULL CHECK (recorded_at >= 0),
  UNIQUE (organization_id, command_id),
  UNIQUE (organization_id, employee_id),
  CHECK (json_extract(source_json, '$.employeeId') IS employee_id),
  CHECK (json_extract(source_json, '$.organizationRevision') IS observed_company_revision),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);

CREATE TABLE company_lifecycle_outbox_entries (
  -- 人事の発令と同じ batch で行を足すため、主キーは列の既定値で採番する。
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  legacy_id TEXT UNIQUE,
  personnel_action_id TEXT NOT NULL,
  effect_type TEXT NOT NULL CHECK (effect_type IN ('hire', 'retired')),
  payload_json TEXT NOT NULL CHECK (json_valid(payload_json)),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  next_attempt_at INTEGER NOT NULL,
  processed_at INTEGER,
  last_error_code TEXT,
  created_at INTEGER NOT NULL,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);

CREATE TABLE company_organization_assignment_period_versions (
  -- 旧来の主キーで行を足す書込みが残るため、主キーは列の既定値でも採番する。
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  period_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision >= 1),
  employment_id TEXT NOT NULL CHECK (length(employment_id) BETWEEN 1 AND 200),
  employee_id TEXT NOT NULL CHECK (length(employee_id) BETWEEN 1 AND 128),
  organization_unit_id TEXT NOT NULL
    REFERENCES company_organization_units(id) ON DELETE RESTRICT,
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
    REFERENCES company_organization_change_operations(id) ON DELETE RESTRICT,
  recorded_at INTEGER NOT NULL CHECK (recorded_at >= 0),
  UNIQUE (period_id, revision),
  CHECK (
    length(starts_on) = 10 AND date(starts_on) IS starts_on
    AND (ends_on IS NULL OR (length(ends_on) = 10 AND date(ends_on) IS ends_on))
    AND (ends_on IS NULL OR starts_on < ends_on)
  ),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
) WITHOUT ROWID;

CREATE TABLE company_organization_change_operations (
  id TEXT PRIMARY KEY NOT NULL,
  operation_key TEXT UNIQUE CHECK (operation_key IS NULL OR length(operation_key) BETWEEN 1 AND 256),
  legacy_id TEXT UNIQUE,
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
CHECK (json_valid(evidence_references_json) AND json_type(evidence_references_json) = 'array'),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);

CREATE TABLE "company_organization_lifecycle_states" (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  updated_at INTEGER NOT NULL
);

CREATE TABLE company_organization_resource_adoptions (
  -- 旧来の主キーで行を足す書込みが残るため、主キーは列の既定値でも採番する。
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  command_id TEXT NOT NULL UNIQUE CHECK (length(command_id) BETWEEN 1 AND 200),
  organization_unit_id TEXT NOT NULL UNIQUE REFERENCES company_organization_units(id) ON DELETE RESTRICT,
  fingerprint TEXT NOT NULL CHECK (length(fingerprint) = 64 AND fingerprint NOT GLOB '*[^0-9a-f]*'),
  actor_account_id TEXT NOT NULL REFERENCES system_accounts(id) ON DELETE RESTRICT,
  reason TEXT NOT NULL CHECK (length(trim(reason)) BETWEEN 1 AND 1000),
  expected_revision INTEGER NOT NULL CHECK (expected_revision >= 0),
  organization_revision INTEGER NOT NULL CHECK (organization_revision > expected_revision AND organization_revision <= expected_revision + 100),
  observed_on TEXT NOT NULL CHECK (length(observed_on) = 10),
  snapshot_digest TEXT NOT NULL CHECK (length(snapshot_digest) = 64 AND snapshot_digest NOT GLOB '*[^0-9a-f]*'),
  source_json TEXT NOT NULL CHECK (json_valid(source_json) AND length(CAST(source_json AS BLOB)) <= 750000),
  recorded_at INTEGER NOT NULL CHECK (recorded_at >= 0),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);

CREATE TABLE company_organization_resource_bindings (
  organization_unit_id TEXT PRIMARY KEY NOT NULL REFERENCES company_organization_units(id) ON DELETE RESTRICT,
  organization_id TEXT NOT NULL REFERENCES company_organizations(id) ON DELETE RESTRICT CHECK (organization_id = 'ad4f6cb1-774b-43ae-950f-80e9bc67c66d'),
  recorded_at INTEGER NOT NULL CHECK (recorded_at >= 0),
  CHECK (length(organization_unit_id) = 36 AND organization_unit_id NOT GLOB '*[^0-9a-f-]*' AND substr(organization_unit_id, 9, 1) = '-' AND substr(organization_unit_id, 14, 1) = '-' AND substr(organization_unit_id, 19, 1) = '-' AND substr(organization_unit_id, 24, 1) = '-' AND length(replace(organization_unit_id, '-', '')) = 32 AND substr(organization_unit_id, 15, 1) GLOB '[1-8]' AND substr(organization_unit_id, 20, 1) GLOB '[89ab]')
);

CREATE TABLE company_organization_responsibility_period_versions (
  -- 旧来の主キーで行を足す書込みが残るため、主キーは列の既定値でも採番する。
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  period_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision >= 1),
  employment_id TEXT NOT NULL CHECK (length(employment_id) BETWEEN 1 AND 200),
  employee_id TEXT NOT NULL CHECK (length(employee_id) BETWEEN 1 AND 128),
  organization_unit_id TEXT NOT NULL
    REFERENCES company_organization_units(id) ON DELETE RESTRICT,
  responsibility_type TEXT NOT NULL CHECK (
    length(responsibility_type) BETWEEN 1 AND 64
    AND responsibility_type GLOB '[A-Z]*'
    AND responsibility_type NOT GLOB '*[^A-Z0-9_]*'
  ),
  starts_on TEXT NOT NULL,
  ends_on TEXT,
  is_void INTEGER NOT NULL DEFAULT 0 CHECK (is_void IN (0, 1)),
  recorded_by_action_id TEXT NOT NULL
    REFERENCES company_organization_change_operations(id) ON DELETE RESTRICT,
  recorded_at INTEGER NOT NULL CHECK (recorded_at >= 0),
  UNIQUE (period_id, revision),
  CHECK (
    length(starts_on) = 10 AND date(starts_on) IS starts_on
    AND (ends_on IS NULL OR (length(ends_on) = 10 AND date(ends_on) IS ends_on))
    AND (ends_on IS NULL OR starts_on < ends_on)
  ),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
) WITHOUT ROWID;

CREATE TABLE company_organization_unit_period_versions (
  -- 旧来の主キーで行を足す書込みが残るため、主キーは列の既定値でも採番する。
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  period_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision >= 1),
  organization_unit_id TEXT NOT NULL
    REFERENCES company_organization_units(id) ON DELETE RESTRICT,
  code TEXT NOT NULL
    CHECK (length(code) BETWEEN 1 AND 64 AND trim(code) = code),
  official_name TEXT NOT NULL
    CHECK (length(official_name) BETWEEN 1 AND 200 AND trim(official_name) = official_name),
  kind TEXT NOT NULL
    CHECK (kind IN ('COMPANY', 'DIVISION', 'DEPARTMENT', 'TEAM', 'OTHER')),
  parent_organization_unit_id TEXT
    REFERENCES company_organization_units(id) ON DELETE RESTRICT,
  starts_on TEXT NOT NULL,
  ends_on TEXT,
  is_void INTEGER NOT NULL DEFAULT 0 CHECK (is_void IN (0, 1)),
  recorded_by_action_id TEXT NOT NULL
    REFERENCES company_organization_change_operations(id) ON DELETE RESTRICT,
  recorded_at INTEGER NOT NULL CHECK (recorded_at >= 0),
  UNIQUE (period_id, revision),
  CHECK (
    length(starts_on) = 10 AND date(starts_on) IS starts_on
    AND (ends_on IS NULL OR (length(ends_on) = 10 AND date(ends_on) IS ends_on))
    AND (ends_on IS NULL OR starts_on < ends_on)
  ),
  CHECK (
    parent_organization_unit_id IS NULL
    OR parent_organization_unit_id != organization_unit_id
  ),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
) WITHOUT ROWID;

CREATE TABLE company_organization_units (
  id TEXT PRIMARY KEY NOT NULL,
  legacy_id TEXT UNIQUE,
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);

CREATE TABLE company_organizations (
  id TEXT PRIMARY KEY NOT NULL,
  legacy_id TEXT UNIQUE,
  revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  updated_at INTEGER NOT NULL CHECK (updated_at >= created_at)
, name TEXT NOT NULL DEFAULT ''
  CHECK (length(name) <= 200 AND trim(name) = name AND instr(name, char(0)) = 0), representative_name TEXT NOT NULL DEFAULT ''
  CHECK (
    length(representative_name) <= 200
    AND trim(representative_name) = representative_name
    AND instr(representative_name, char(0)) = 0
  ),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);

CREATE TABLE company_personnel_action_requests (
  id TEXT PRIMARY KEY NOT NULL,
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
, base_company_revision INTEGER
CHECK (base_company_revision IS NULL OR base_company_revision >= 0),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);

CREATE TABLE company_personnel_actions (
  id TEXT PRIMARY KEY NOT NULL,
  legacy_id TEXT UNIQUE,
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
  CHECK (recorded_by_account_id IS NULL OR length(recorded_by_account_id) BETWEEN 1 AND 255),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);

CREATE TABLE company_personnel_annotations (
  id TEXT PRIMARY KEY NOT NULL,
  legacy_id TEXT UNIQUE,
  employee_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  effective_date TEXT NOT NULL,
  from_department_code TEXT,
  to_department_code TEXT,
  note TEXT,
  created_at TEXT NOT NULL,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);

CREATE TABLE company_personnel_reporting_bindings (
  resource_id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL DEFAULT 'ad4f6cb1-774b-43ae-950f-80e9bc67c66d' CHECK (organization_id = 'ad4f6cb1-774b-43ae-950f-80e9bc67c66d'),
  resource_type TEXT NOT NULL DEFAULT 'reporting-relation' CHECK (resource_type = 'reporting-relation'),
  employee_id TEXT NOT NULL REFERENCES company_employees(id) ON DELETE RESTRICT,
  employment_id TEXT NOT NULL REFERENCES company_employments(id) ON DELETE RESTRICT,
  organization_unit_id TEXT NOT NULL REFERENCES company_organization_units(id) ON DELETE RESTRICT,
  assignment_type TEXT NOT NULL CHECK (assignment_type IN ('PRIMARY', 'CONCURRENT')),
  recorded_by_action_id TEXT REFERENCES company_personnel_actions(id) ON DELETE RESTRICT,
  recorded_by_adoption_id TEXT REFERENCES company_assignment_resource_adoptions(command_id) ON DELETE RESTRICT,
  CHECK ((recorded_by_action_id IS NULL) != (recorded_by_adoption_id IS NULL)),
  UNIQUE (employee_id, employment_id, organization_unit_id, assignment_type),
  FOREIGN KEY (organization_id, resource_type, resource_id)
    REFERENCES company_resource_heads(organization_id, resource_type, resource_id) ON DELETE RESTRICT,
  CHECK (length(resource_id) = 36 AND resource_id NOT GLOB '*[^0-9a-f-]*' AND substr(resource_id, 9, 1) = '-' AND substr(resource_id, 14, 1) = '-' AND substr(resource_id, 19, 1) = '-' AND substr(resource_id, 24, 1) = '-' AND length(replace(resource_id, '-', '')) = 32 AND substr(resource_id, 15, 1) GLOB '[1-8]' AND substr(resource_id, 20, 1) GLOB '[89ab]')
);

CREATE TABLE company_profile_change_receipts (
  -- 旧来の主キーで行を足す書込みが残るため、主キーは列の既定値でも採番する。
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  organization_id TEXT NOT NULL REFERENCES company_organizations(id),
  command_id TEXT NOT NULL,
  fingerprint TEXT NOT NULL CHECK (length(fingerprint) = 64 AND fingerprint NOT GLOB '*[^0-9a-f]*'),
  actor_account_id TEXT NOT NULL REFERENCES system_accounts(id),
  organization_revision INTEGER NOT NULL CHECK (organization_revision > 0),
  declaration_json TEXT NOT NULL CHECK (json_valid(declaration_json)),
  source_json TEXT NOT NULL CHECK (json_valid(source_json)),
  recorded_at INTEGER NOT NULL CHECK (recorded_at >= 0),
  UNIQUE (organization_id, command_id),
  FOREIGN KEY (organization_id, command_id) REFERENCES company_command_receipts(organization_id, command_id),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);

CREATE TABLE company_resource_heads (
  -- 旧来の主キーで行を足す書込みが残るため、主キーは列の既定値でも採番する。
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
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
  UNIQUE (organization_id, resource_type, resource_id),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);

CREATE TABLE company_resource_revisions (
  -- 旧来の主キーで行を足す書込みが残るため、主キーは列の既定値でも採番する。
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
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
  recorded_at INTEGER NOT NULL CHECK (recorded_at >= 0), evidence_references_json TEXT NOT NULL DEFAULT '[]'
  CHECK (json_valid(evidence_references_json) AND json_type(evidence_references_json) = 'array'), corrects_revision INTEGER
  CHECK (corrects_revision IS NULL OR (corrects_revision >= 1 AND corrects_revision < revision)),
  UNIQUE (organization_id, resource_type, resource_id, revision),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);

CREATE TABLE company_responsibility_period_bindings (
  period_id TEXT PRIMARY KEY NOT NULL,
  resource_id TEXT NOT NULL REFERENCES company_responsibility_resource_bindings(resource_id) ON DELETE RESTRICT,
  period_revision INTEGER NOT NULL CHECK (period_revision >= 1),
  source_revision INTEGER NOT NULL CHECK (source_revision >= 1),
  FOREIGN KEY (period_id, period_revision) REFERENCES company_organization_responsibility_period_versions(period_id, revision) ON DELETE RESTRICT,
  CHECK (length(period_id) = 36 AND period_id NOT GLOB '*[^0-9a-f-]*' AND substr(period_id, 9, 1) = '-' AND substr(period_id, 14, 1) = '-' AND substr(period_id, 19, 1) = '-' AND substr(period_id, 24, 1) = '-' AND length(replace(period_id, '-', '')) = 32 AND substr(period_id, 15, 1) GLOB '[1-8]' AND substr(period_id, 20, 1) GLOB '[89ab]')
);

CREATE TABLE company_responsibility_resource_adoptions (
  -- 旧来の主キーで行を足す書込みが残るため、主キーは列の既定値でも採番する。
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  command_id TEXT NOT NULL UNIQUE CHECK (length(command_id) BETWEEN 1 AND 200),
  operation_id TEXT NOT NULL UNIQUE REFERENCES company_organization_change_operations(id) ON DELETE RESTRICT,
  employee_id TEXT NOT NULL REFERENCES company_employees(id) ON DELETE RESTRICT,
  fingerprint TEXT NOT NULL CHECK (length(fingerprint) = 64),
  actor_account_id TEXT NOT NULL REFERENCES system_accounts(id) ON DELETE RESTRICT,
  reason TEXT NOT NULL CHECK (length(trim(reason)) BETWEEN 1 AND 1000),
  expected_revision INTEGER NOT NULL CHECK (expected_revision >= 0),
  organization_revision INTEGER NOT NULL CHECK (organization_revision > expected_revision AND organization_revision <= expected_revision + 10),
  observed_on TEXT NOT NULL CHECK (length(observed_on) = 10),
  adopted_periods INTEGER NOT NULL CHECK (adopted_periods BETWEEN 1 AND 1000),
  snapshot_digest TEXT NOT NULL CHECK (length(snapshot_digest) = 64),
  source_json TEXT NOT NULL CHECK (json_valid(source_json) AND length(CAST(source_json AS BLOB)) <= 750000),
  mappings_json TEXT NOT NULL CHECK (json_valid(mappings_json) AND json_type(mappings_json) = 'array' AND json_array_length(mappings_json) = adopted_periods AND length(CAST(mappings_json AS BLOB)) <= 750000),
  recorded_at INTEGER NOT NULL CHECK (recorded_at >= 0),
  UNIQUE (employee_id, snapshot_digest),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);

CREATE TABLE company_responsibility_resource_bindings (
  resource_id TEXT PRIMARY KEY NOT NULL CHECK (length(resource_id) BETWEEN 1 AND 255),
  organization_id TEXT NOT NULL REFERENCES company_organizations(id) ON DELETE RESTRICT CHECK (organization_id = 'ad4f6cb1-774b-43ae-950f-80e9bc67c66d'),
  employee_id TEXT NOT NULL REFERENCES company_employees(id) ON DELETE RESTRICT,
  employment_id TEXT NOT NULL REFERENCES company_employments(id) ON DELETE RESTRICT,
  organization_unit_id TEXT NOT NULL REFERENCES company_organization_units(id) ON DELETE RESTRICT,
  responsibility_type TEXT NOT NULL CHECK (length(responsibility_type) BETWEEN 1 AND 100),
  responsibility_id TEXT NOT NULL,
  authority_scope_id TEXT NOT NULL,
  resource_revision INTEGER NOT NULL CHECK (resource_revision >= 1),
  recorded_at INTEGER NOT NULL CHECK (recorded_at >= 0),
  CHECK (length(resource_id) = 36 AND resource_id NOT GLOB '*[^0-9a-f-]*' AND substr(resource_id, 9, 1) = '-' AND substr(resource_id, 14, 1) = '-' AND substr(resource_id, 19, 1) = '-' AND substr(resource_id, 24, 1) = '-' AND length(replace(resource_id, '-', '')) = 32 AND substr(resource_id, 15, 1) GLOB '[1-8]' AND substr(resource_id, 20, 1) GLOB '[89ab]')
);

CREATE TABLE company_responsibility_source_adoptions (
  -- 旧来の主キーで行を足す書込みが残るため、主キーは列の既定値でも採番する。
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  organization_id TEXT NOT NULL DEFAULT 'ad4f6cb1-774b-43ae-950f-80e9bc67c66d'
    CHECK (organization_id = 'ad4f6cb1-774b-43ae-950f-80e9bc67c66d'),
  source_context TEXT NOT NULL CHECK (length(trim(source_context)) BETWEEN 1 AND 100),
  source_kind TEXT NOT NULL CHECK (length(trim(source_kind)) BETWEEN 1 AND 100),
  source_namespace TEXT NOT NULL CHECK (length(trim(source_namespace)) BETWEEN 1 AND 255),
  freeze_id TEXT NOT NULL,
  source_id TEXT NOT NULL CHECK (length(trim(source_id)) BETWEEN 1 AND 255),
  source_version TEXT NOT NULL CHECK (length(trim(source_version)) BETWEEN 1 AND 255),
  command_id TEXT NOT NULL,
  resource_type TEXT NOT NULL DEFAULT 'responsibility-assignment'
    CHECK (resource_type = 'responsibility-assignment'),
  resource_id TEXT NOT NULL,
  resource_revision INTEGER NOT NULL CHECK (resource_revision > 0),
  snapshot_digest TEXT NOT NULL
    CHECK (length(snapshot_digest) = 64 AND snapshot_digest NOT GLOB '*[^0-9a-f]*'),
  source_json TEXT NOT NULL
    CHECK (json_valid(source_json) AND json_type(source_json) = 'object'
      AND length(CAST(source_json AS BLOB)) <= 750000),
  actor_account_id TEXT NOT NULL REFERENCES system_accounts(id) ON DELETE RESTRICT,
  reason TEXT NOT NULL CHECK (length(trim(reason)) BETWEEN 1 AND 2000),
  expected_revision INTEGER NOT NULL CHECK (expected_revision >= 0),
  organization_revision INTEGER NOT NULL
    CHECK (organization_revision = expected_revision + 1),
  recorded_at INTEGER NOT NULL CHECK (recorded_at >= 0),
  UNIQUE (organization_id, source_context, source_kind, source_id, source_version),
  UNIQUE (organization_id, command_id),
  FOREIGN KEY (organization_id, command_id)
    REFERENCES company_command_receipts(organization_id, command_id) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, resource_type, resource_id)
    REFERENCES company_resource_heads(organization_id, resource_type, resource_id) ON DELETE RESTRICT,
  FOREIGN KEY (freeze_id) REFERENCES system_record_source_freezes(id) ON DELETE RESTRICT,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);

CREATE TABLE company_responsibility_source_cutovers (
  -- 旧来の主キーで行を足す書込みが残るため、主キーは列の既定値でも採番する。
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  organization_id TEXT NOT NULL DEFAULT 'ad4f6cb1-774b-43ae-950f-80e9bc67c66d'
    CHECK (organization_id = 'ad4f6cb1-774b-43ae-950f-80e9bc67c66d'),
  source_context TEXT NOT NULL CHECK (length(trim(source_context)) BETWEEN 1 AND 100),
  source_kind TEXT NOT NULL CHECK (length(trim(source_kind)) BETWEEN 1 AND 100),
  source_namespace TEXT NOT NULL CHECK (length(trim(source_namespace)) BETWEEN 1 AND 255),
  freeze_id TEXT NOT NULL,
  source_count INTEGER NOT NULL CHECK (source_count >= 0),
  adopted_count INTEGER NOT NULL CHECK (adopted_count = source_count),
  source_manifest_digest TEXT NOT NULL
    CHECK (length(source_manifest_digest) = 64
      AND source_manifest_digest NOT GLOB '*[^0-9a-f]*'),
  source_manifest_json TEXT NOT NULL
    CHECK (json_valid(source_manifest_json) AND json_type(source_manifest_json) = 'array'
      AND json_array_length(source_manifest_json) = source_count
      AND length(CAST(source_manifest_json AS BLOB)) <= 750000),
  audit_event_id TEXT NOT NULL REFERENCES company_audit_events(event_id) ON DELETE RESTRICT,
  actor_account_id TEXT NOT NULL REFERENCES system_accounts(id) ON DELETE RESTRICT,
  completed_at INTEGER NOT NULL CHECK (completed_at >= 0),
  UNIQUE (organization_id, source_context, source_kind),
  UNIQUE (freeze_id),
  FOREIGN KEY (freeze_id) REFERENCES system_record_source_freezes(id) ON DELETE RESTRICT,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);

CREATE TABLE company_workforce_connection_completions (
  -- 旧来の主キーで行を足す書込みが残るため、主キーは列の既定値でも採番する。
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  organization_id TEXT NOT NULL UNIQUE REFERENCES company_organizations(id) ON DELETE RESTRICT
    CHECK (organization_id = 'ad4f6cb1-774b-43ae-950f-80e9bc67c66d'),
  command_id TEXT NOT NULL UNIQUE CHECK (length(command_id) BETWEEN 1 AND 255),
  actor_account_id TEXT NOT NULL CHECK (length(actor_account_id) BETWEEN 1 AND 255),
  reason TEXT NOT NULL CHECK (length(reason) BETWEEN 1 AND 2000),
  employee_count INTEGER NOT NULL CHECK (employee_count >= 0),
  employment_count INTEGER NOT NULL CHECK (employment_count >= 0),
  completed_at INTEGER NOT NULL CHECK (completed_at >= 0),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);

CREATE TABLE company_workforce_resource_bindings (
  -- 旧来の主キーで行を足す書込みが残るため、主キーは列の既定値でも採番する。
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  resource_type TEXT NOT NULL CHECK (resource_type IN ('employee', 'employment')),
  resource_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  employee_id TEXT NOT NULL REFERENCES company_employees(id) ON DELETE RESTRICT,
  resource_revision INTEGER NOT NULL CHECK (resource_revision > 0),
  lifecycle_revision INTEGER NOT NULL CHECK (lifecycle_revision >= 0),
  last_action_id TEXT,
  UNIQUE (resource_type, resource_id),
  FOREIGN KEY (organization_id, resource_type, resource_id)
    REFERENCES company_resource_heads(organization_id, resource_type, resource_id)
    ON DELETE RESTRICT,
  CHECK (resource_type != 'employee' OR resource_id = employee_id),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);

CREATE TABLE system_account_invitations (
  id TEXT PRIMARY KEY NOT NULL,
  token TEXT NOT NULL,
  subject TEXT,
  role_id TEXT NOT NULL
    REFERENCES system_iam_roles(id) ON DELETE RESTRICT,
  accepted_by_account_id TEXT
    REFERENCES system_accounts(id) ON DELETE RESTRICT,
  expires_at INTEGER NOT NULL,
  revoked_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL, resource_type TEXT, resource_id TEXT
  CHECK ((resource_type IS NULL AND resource_id IS NULL) OR (
    resource_type IS NOT NULL AND resource_id IS NOT NULL
    AND length(resource_type) BETWEEN 3 AND 100
    AND length(resource_id) BETWEEN 1 AND 255
  )), related_resource_id TEXT
  CHECK (related_resource_id IS NULL OR (
    resource_type IS NOT NULL AND resource_id IS NOT NULL
    AND length(related_resource_id) BETWEEN 1 AND 255
  )),
  CHECK (
    updated_at >= created_at
    AND expires_at >= created_at
    AND (revoked_at IS NULL OR revoked_at >= created_at)
  ),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);

CREATE TABLE system_accounts (
  id TEXT PRIMARY KEY NOT NULL,
  legacy_id TEXT UNIQUE,
  status TEXT NOT NULL
    CHECK (status IN ('active', 'suspended', 'locked')),
  token_version INTEGER NOT NULL DEFAULT 0
    CHECK (token_version >= 0),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
    CHECK (updated_at >= created_at)
, closed_at INTEGER
  CHECK (closed_at IS NULL OR closed_at >= created_at),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);

CREATE TABLE system_attachment_preservations (
  id TEXT PRIMARY KEY NOT NULL,
  attachment_id TEXT NOT NULL,
  plaintext_sha256 TEXT NOT NULL CHECK (length(plaintext_sha256) = 64),
  kind TEXT NOT NULL CHECK (kind IN ('hold', 'retention')),
  retain_until INTEGER,
  reason TEXT NOT NULL CHECK (length(trim(reason)) BETWEEN 1 AND 1000),
  created_by_account_id TEXT NOT NULL,
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  created_audit_event_id TEXT NOT NULL UNIQUE REFERENCES system_audit_events(event_id),
  revision INTEGER NOT NULL CHECK (revision IN (1, 2)),
  release_operation_id TEXT UNIQUE,
  released_by_account_id TEXT,
  released_at INTEGER,
  release_reason TEXT,
  release_audit_event_id TEXT UNIQUE REFERENCES system_audit_events(event_id),
  CHECK ((kind = 'hold' AND retain_until IS NULL) OR (kind = 'retention' AND retain_until IS NOT NULL AND retain_until > created_at)),
  CHECK ((revision = 1 AND release_operation_id IS NULL AND released_by_account_id IS NULL AND released_at IS NULL AND release_reason IS NULL AND release_audit_event_id IS NULL)
    OR (revision = 2 AND kind = 'hold' AND release_operation_id IS NOT NULL AND released_by_account_id IS NOT NULL AND released_at IS NOT NULL AND released_at >= created_at AND release_reason IS NOT NULL AND length(trim(release_reason)) BETWEEN 1 AND 1000 AND release_audit_event_id IS NOT NULL)),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);

CREATE TABLE system_attachments (
  id TEXT PRIMARY KEY NOT NULL,
  owner_account_id TEXT NOT NULL,
  object_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL,
  content_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL,
  file_name TEXT NOT NULL,
  plaintext_sha256 TEXT NOT NULL,
  wrapped_dek TEXT,
  wrapped_dek_iv TEXT,
  content_iv TEXT NOT NULL,
  kek_version INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  linked_at INTEGER,
  erased_at INTEGER,
  CHECK (status IN ('uploading', 'pending', 'linked', 'erased')),
  CHECK (byte_size > 0),
  CHECK (kek_version > 0),
  CHECK (object_key LIKE 'att/%' AND length(object_key) <= 255),
  CHECK ((status = 'erased') = (wrapped_dek IS NULL)),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);

CREATE TABLE system_audit_disclosure_policy_revisions (
  id TEXT PRIMARY KEY NOT NULL,
  scope TEXT NOT NULL CHECK (length(scope) BETWEEN 1 AND 255),
  revision INTEGER NOT NULL CHECK (revision > 0),
  command_id TEXT NOT NULL UNIQUE,
  enabled INTEGER NOT NULL CHECK (enabled IN (0, 1)),
  allowed_fields_json TEXT NOT NULL CHECK (json_valid(allowed_fields_json) AND json_type(allowed_fields_json) = 'array'),
  allowed_target_types_json TEXT CHECK (allowed_target_types_json IS NULL OR (json_valid(allowed_target_types_json) AND json_type(allowed_target_types_json) = 'array')),
  allowed_purposes_json TEXT CHECK (allowed_purposes_json IS NULL OR (json_valid(allowed_purposes_json) AND json_type(allowed_purposes_json) = 'array')),
  expires_at INTEGER,
  reason TEXT NOT NULL CHECK (length(trim(reason)) BETWEEN 1 AND 1000),
  actor_account_id TEXT NOT NULL REFERENCES system_accounts(id) ON DELETE RESTRICT,
  recorded_at INTEGER NOT NULL CHECK (recorded_at >= 0),
  audit_event_id TEXT NOT NULL UNIQUE REFERENCES system_audit_events(event_id) ON DELETE RESTRICT,
  CHECK (expires_at IS NULL OR expires_at > recorded_at),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);

CREATE TABLE system_audit_events (
  event_id TEXT PRIMARY KEY NOT NULL,
  actor_account_id TEXT,
  action TEXT NOT NULL
    CHECK (length(action) BETWEEN 3 AND 200),
  target_type TEXT NOT NULL
    CHECK (length(target_type) BETWEEN 1 AND 200),
  target_id TEXT,
  outcome TEXT NOT NULL
    CHECK (outcome IN ('succeeded', 'denied', 'failed')),
  reason_code TEXT,
  authorization_json TEXT,
  before_json TEXT,
  after_json TEXT,
  metadata_json TEXT,
  occurred_at INTEGER NOT NULL,
  CHECK (authorization_json IS NULL OR json_valid(authorization_json)),
  CHECK (before_json IS NULL OR json_valid(before_json)),
  CHECK (after_json IS NULL OR json_valid(after_json)),
  CHECK (metadata_json IS NULL OR json_valid(metadata_json)),
  CHECK (length(event_id) = 36 AND event_id NOT GLOB '*[^0-9a-f-]*' AND substr(event_id, 9, 1) = '-' AND substr(event_id, 14, 1) = '-' AND substr(event_id, 19, 1) = '-' AND substr(event_id, 24, 1) = '-' AND length(replace(event_id, '-', '')) = 32 AND substr(event_id, 15, 1) GLOB '[1-8]' AND substr(event_id, 20, 1) GLOB '[89ab]')
);

CREATE TABLE system_authentication_attempts (
  id TEXT PRIMARY KEY NOT NULL,
  identifier TEXT NOT NULL
    CHECK (length(identifier) BETWEEN 1 AND 2048),
  ip TEXT
    CHECK (ip IS NULL OR length(ip) BETWEEN 1 AND 255),
  attempted_at INTEGER NOT NULL,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);

CREATE TABLE system_batch_jobs (
  id TEXT PRIMARY KEY NOT NULL,
  legacy_id TEXT UNIQUE,
  name TEXT NOT NULL
    CHECK (length(name) BETWEEN 1 AND 200),
  status TEXT NOT NULL
    CHECK (status IN ('running', 'completed', 'failed')),
  started_at INTEGER,
  finished_at INTEGER,
  message TEXT,
  CHECK (finished_at IS NULL OR started_at IS NULL OR finished_at >= started_at),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);

CREATE TABLE system_bootstrap_state (
  singleton INTEGER PRIMARY KEY NOT NULL
    CHECK (singleton = 1),
  completed_by_account_id TEXT NOT NULL UNIQUE
    REFERENCES system_accounts(id) ON DELETE RESTRICT,
  root_binding_id TEXT NOT NULL UNIQUE
    REFERENCES system_role_bindings(id) ON DELETE RESTRICT,
  completed_at INTEGER NOT NULL
);

CREATE TABLE system_browser_login_codes (
  code_hash TEXT PRIMARY KEY NOT NULL
    CHECK (length(code_hash) BETWEEN 32 AND 512),
  account_id TEXT NOT NULL
    REFERENCES system_accounts(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  CHECK (expires_at > created_at)
);

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
    CHECK (updated_at >= created_at),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);

CREATE TABLE system_cli_login_codes (
  code_hash TEXT PRIMARY KEY NOT NULL
    CHECK (length(code_hash) BETWEEN 32 AND 512),
  account_id TEXT NOT NULL
    REFERENCES system_accounts(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  CHECK (expires_at > created_at)
);

CREATE TABLE system_cli_login_states (
  state TEXT PRIMARY KEY NOT NULL
    CHECK (length(state) BETWEEN 16 AND 512),
  port INTEGER NOT NULL
    CHECK (port BETWEEN 1 AND 65535),
  cli_state TEXT NOT NULL
    CHECK (length(cli_state) BETWEEN 1 AND 512),
  code_verifier TEXT NOT NULL
    CHECK (length(code_verifier) BETWEEN 43 AND 128),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  CHECK (expires_at > created_at)
);

CREATE TABLE system_connectors (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) BETWEEN 1 AND 255),
  key TEXT NOT NULL UNIQUE CHECK (length(key) BETWEEN 1 AND 63),
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 200 AND trim(name) = name),
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound', 'bidirectional')),
  transport TEXT NOT NULL CHECK (transport IN ('api', 'file', 'webhook')),
  status TEXT NOT NULL CHECK (status IN ('active', 'disabled')),
  revision INTEGER NOT NULL CHECK (revision >= 1),
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  updated_at INTEGER NOT NULL CHECK (updated_at >= created_at),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);

CREATE TABLE system_dead_letters (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) BETWEEN 1 AND 255),
  source_type TEXT NOT NULL CHECK (source_type IN ('job', 'outbox', 'inbox')),
  source_id TEXT NOT NULL CHECK (length(source_id) BETWEEN 1 AND 255),
  payload_digest TEXT NOT NULL CHECK (length(payload_digest) = 64 AND payload_digest NOT GLOB '*[^0-9a-f]*'),
  reason_code TEXT NOT NULL CHECK (length(reason_code) BETWEEN 1 AND 200),
  attempt INTEGER NOT NULL CHECK (attempt BETWEEN 0 AND 100),
  recorded_at INTEGER NOT NULL CHECK (recorded_at >= 0),
  requeued_job_id TEXT REFERENCES system_jobs(id) ON DELETE RESTRICT,
  requeued_at INTEGER,
  CHECK ((requeued_job_id IS NULL) = (requeued_at IS NULL)),
  CHECK (requeued_at IS NULL OR requeued_at >= recorded_at),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);

CREATE TABLE system_decision_task_candidates (
  -- 旧来の主キーで行を足す書込みが残るため、主キーは列の既定値でも採番する。
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
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
  UNIQUE (case_id, task_key, round, candidate_account_id, source),
  FOREIGN KEY (case_id, task_key, round)
    REFERENCES system_decision_tasks(case_id, task_key, round) ON DELETE RESTRICT,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);

CREATE TABLE system_decision_task_exclusions (
  -- 旧来の主キーで行を足す書込みが残るため、主キーは列の既定値でも採番する。
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  case_id TEXT NOT NULL,
  task_key TEXT NOT NULL,
  round INTEGER NOT NULL,
  excluded_account_id TEXT NOT NULL
    REFERENCES system_accounts(id) ON DELETE RESTRICT,
  reason TEXT NOT NULL
    CHECK (reason IN ('creator', 'subject', 'policy')),
  UNIQUE (case_id, task_key, round, excluded_account_id),
  FOREIGN KEY (case_id, task_key, round)
    REFERENCES system_decision_tasks(case_id, task_key, round) ON DELETE RESTRICT,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);

CREATE TABLE system_decision_tasks (
  -- 旧来の主キーで行を足す書込みが残るため、主キーは列の既定値でも採番する。
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
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
    CHECK (closed_at IS NULL OR closed_at >= opened_at), required_participants INTEGER NOT NULL DEFAULT 1
  CHECK (required_participants BETWEEN 1 AND 100), negative_decision_rule TEXT NOT NULL DEFAULT 'any-reject'
  CHECK (negative_decision_rule IN ('any-reject', 'approval-impossible')), delegation_policy TEXT NOT NULL DEFAULT 'allowed'
  CHECK (delegation_policy IN ('allowed', 'forbidden')), return_policy TEXT NOT NULL DEFAULT 'allowed'
  CHECK (return_policy IN ('allowed', 'forbidden')),
  CHECK (
    (outcome IS NULL AND closed_at IS NULL)
    OR (outcome IS NOT NULL AND closed_at IS NOT NULL)
  ),
  UNIQUE (case_id, task_key, round),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);

CREATE TABLE system_delegation_numbers (
  number INTEGER PRIMARY KEY AUTOINCREMENT,
  delegation_id TEXT NOT NULL
    REFERENCES system_delegations(id) ON DELETE RESTRICT
);

CREATE TABLE system_delegation_procedure_scopes (
  delegation_id TEXT PRIMARY KEY NOT NULL
    REFERENCES system_delegations(id) ON DELETE RESTRICT,
  procedure_key TEXT NOT NULL
    REFERENCES system_procedure_definitions(key) ON DELETE RESTRICT,
  CHECK (length(delegation_id) = 36 AND delegation_id NOT GLOB '*[^0-9a-f-]*' AND substr(delegation_id, 9, 1) = '-' AND substr(delegation_id, 14, 1) = '-' AND substr(delegation_id, 19, 1) = '-' AND substr(delegation_id, 24, 1) = '-' AND length(replace(delegation_id, '-', '')) = 32 AND substr(delegation_id, 15, 1) GLOB '[1-8]' AND substr(delegation_id, 20, 1) GLOB '[89ab]')
);

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
  ),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);

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
  ),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);

CREATE TABLE system_external_assertions (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) BETWEEN 1 AND 255),
  connector_id TEXT NOT NULL REFERENCES system_connectors(id) ON DELETE RESTRICT,
  exchange_id TEXT REFERENCES system_integration_exchanges(id) ON DELETE RESTRICT,
  external_key TEXT NOT NULL CHECK (length(external_key) BETWEEN 1 AND 512),
  external_version TEXT NOT NULL CHECK (length(external_version) BETWEEN 1 AND 255),
  payload_digest TEXT NOT NULL CHECK (length(payload_digest) = 64 AND payload_digest NOT GLOB '*[^0-9a-f]*'),
  observed_at INTEGER NOT NULL CHECK (observed_at >= 0),
  received_at INTEGER NOT NULL CHECK (received_at >= observed_at),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);

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
    REFERENCES system_decision_tasks(case_id, task_key, round) ON DELETE RESTRICT,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);

CREATE TABLE system_iam_role_permissions (
  -- 旧来の主キーで行を足す書込みが残るため、主キーは列の既定値でも採番する。
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  role_id TEXT NOT NULL
    REFERENCES system_iam_roles(id) ON DELETE CASCADE,
  permission_key TEXT NOT NULL
    CHECK (length(permission_key) BETWEEN 3 AND 100),
  UNIQUE (role_id, permission_key),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
) WITHOUT ROWID;

CREATE TABLE system_iam_roles (
  id TEXT PRIMARY KEY NOT NULL,
  legacy_id TEXT UNIQUE,
  key TEXT NOT NULL
    CHECK (length(key) BETWEEN 3 AND 100),
  kind TEXT NOT NULL
    CHECK (kind IN ('managed', 'custom')),
  name TEXT NOT NULL
    CHECK (length(name) BETWEEN 1 AND 100),
  description TEXT
    CHECK (description IS NULL OR length(description) BETWEEN 1 AND 1000),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
    CHECK (updated_at >= created_at)
, resource_type TEXT
  CHECK (resource_type IS NULL OR length(resource_type) BETWEEN 3 AND 100),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);

CREATE TABLE system_identity_bindings (
  id TEXT PRIMARY KEY NOT NULL,
  account_id TEXT NOT NULL
    REFERENCES system_accounts(id) ON DELETE RESTRICT,
  provider TEXT NOT NULL
    CHECK (provider IN ('password', 'google', 'github', 'oidc')),
  subject TEXT NOT NULL
    CHECK (length(subject) BETWEEN 1 AND 2048),
  created_at INTEGER NOT NULL,
  activated_at INTEGER
    CHECK (activated_at IS NULL OR activated_at >= created_at),
  revoked_at INTEGER
    CHECK (
      revoked_at IS NULL OR (
        revoked_at >= created_at
        AND (activated_at IS NULL OR revoked_at >= activated_at)
      )
    ),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);

CREATE TABLE system_identity_login_tokens (
  jti TEXT PRIMARY KEY NOT NULL
    CHECK (length(jti) BETWEEN 1 AND 512),
  expires_at INTEGER NOT NULL,
  used_at INTEGER NOT NULL,
  CHECK (expires_at > used_at)
);

CREATE TABLE system_identity_profiles (
  identity_id TEXT PRIMARY KEY NOT NULL
    REFERENCES system_identity_bindings(id) ON DELETE CASCADE,
  email TEXT
    CHECK (email IS NULL OR length(email) BETWEEN 3 AND 320),
  email_verified INTEGER NOT NULL DEFAULT 0
    CHECK (email_verified IN (0, 1)),
  last_used_at INTEGER,
  updated_at INTEGER NOT NULL
, can_receive_email INTEGER NOT NULL DEFAULT 1
  CHECK (can_receive_email IN (0, 1)),
  CHECK (length(identity_id) = 36 AND identity_id NOT GLOB '*[^0-9a-f-]*' AND substr(identity_id, 9, 1) = '-' AND substr(identity_id, 14, 1) = '-' AND substr(identity_id, 19, 1) = '-' AND substr(identity_id, 24, 1) = '-' AND length(replace(identity_id, '-', '')) = 32 AND substr(identity_id, 15, 1) GLOB '[1-8]' AND substr(identity_id, 20, 1) GLOB '[89ab]')
);

CREATE TABLE system_inbox_messages (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) BETWEEN 1 AND 255),
  source_key TEXT NOT NULL CHECK (length(source_key) BETWEEN 1 AND 200),
  external_message_id TEXT NOT NULL CHECK (length(external_message_id) BETWEEN 1 AND 512),
  payload_digest TEXT NOT NULL CHECK (length(payload_digest) = 64 AND payload_digest NOT GLOB '*[^0-9a-f]*'),
  status TEXT NOT NULL CHECK (status IN ('accepted', 'processed', 'rejected')),
  received_at INTEGER NOT NULL CHECK (received_at >= 0),
  processed_at INTEGER,
  reason_code TEXT CHECK (reason_code IS NULL OR length(reason_code) BETWEEN 1 AND 200),
  CHECK (
    (status = 'accepted' AND processed_at IS NULL AND reason_code IS NULL)
    OR (status = 'processed' AND processed_at >= received_at AND reason_code IS NULL)
    OR (status = 'rejected' AND processed_at >= received_at AND reason_code IS NOT NULL)
  ),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);

CREATE TABLE system_integration_exchanges (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) BETWEEN 1 AND 255),
  connector_id TEXT NOT NULL REFERENCES system_connectors(id) ON DELETE RESTRICT,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  operation_key TEXT NOT NULL CHECK (length(operation_key) BETWEEN 1 AND 200),
  idempotency_key TEXT NOT NULL CHECK (length(idempotency_key) BETWEEN 1 AND 255),
  payload_digest TEXT NOT NULL CHECK (length(payload_digest) = 64 AND payload_digest NOT GLOB '*[^0-9a-f]*'),
  status TEXT NOT NULL CHECK (status IN ('pending', 'succeeded', 'failed', 'cancelled')),
  attempt INTEGER NOT NULL CHECK (attempt BETWEEN 1 AND 100),
  external_reference TEXT CHECK (external_reference IS NULL OR length(external_reference) BETWEEN 1 AND 512),
  last_error_code TEXT CHECK (last_error_code IS NULL OR length(last_error_code) BETWEEN 1 AND 200),
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  updated_at INTEGER NOT NULL CHECK (updated_at >= created_at),
  completed_at INTEGER CHECK (completed_at IS NULL OR completed_at >= created_at),
  CHECK ((status = 'pending' AND completed_at IS NULL) OR (status <> 'pending' AND completed_at IS NOT NULL)),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);

CREATE TABLE system_jobs (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) BETWEEN 1 AND 255),
  operation_key TEXT NOT NULL CHECK (operation_key GLOB '[a-z]*' AND length(operation_key) <= 200),
  payload_digest TEXT NOT NULL CHECK (length(payload_digest) = 64 AND payload_digest NOT GLOB '*[^0-9a-f]*'),
  idempotency_key TEXT NOT NULL CHECK (length(idempotency_key) BETWEEN 1 AND 255),
  created_by_account_id TEXT NOT NULL REFERENCES system_accounts(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN ('queued', 'leased', 'succeeded', 'dead_letter')),
  attempt INTEGER NOT NULL CHECK (attempt BETWEEN 0 AND max_attempts),
  max_attempts INTEGER NOT NULL CHECK (max_attempts BETWEEN 1 AND 100),
  available_at INTEGER NOT NULL CHECK (available_at >= created_at),
  lease_account_id TEXT REFERENCES system_accounts(id) ON DELETE RESTRICT,
  lease_token_hash TEXT CHECK (lease_token_hash IS NULL OR (length(lease_token_hash) = 64 AND lease_token_hash NOT GLOB '*[^0-9a-f]*')),
  lease_expires_at INTEGER,
  last_error_code TEXT CHECK (last_error_code IS NULL OR length(last_error_code) BETWEEN 1 AND 200),
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  updated_at INTEGER NOT NULL CHECK (updated_at >= created_at),
  completed_at INTEGER, handler_key TEXT CHECK (handler_key IS NULL OR length(handler_key) BETWEEN 1 AND 200),
  CHECK (
    (status = 'leased' AND lease_account_id IS NOT NULL AND lease_token_hash IS NOT NULL
      AND lease_expires_at > updated_at AND completed_at IS NULL)
    OR (status = 'queued' AND lease_account_id IS NULL AND lease_token_hash IS NULL
      AND lease_expires_at IS NULL AND completed_at IS NULL)
    OR (status = 'succeeded' AND lease_account_id IS NULL AND lease_token_hash IS NULL
      AND lease_expires_at IS NULL AND completed_at = updated_at AND last_error_code IS NULL)
    OR (status = 'dead_letter' AND attempt = max_attempts
      AND lease_account_id IS NULL AND lease_token_hash IS NULL
      AND lease_expires_at IS NULL AND completed_at = updated_at AND last_error_code IS NOT NULL)
  ),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);

CREATE TABLE system_machine_credentials (
  id TEXT PRIMARY KEY NOT NULL,
  principal_id TEXT NOT NULL REFERENCES system_principals(id) ON DELETE RESTRICT,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 200 AND trim(name) = name),
  secret_hash TEXT NOT NULL UNIQUE CHECK (
    length(secret_hash) = 64 AND secret_hash NOT GLOB '*[^0-9a-f]*'
  ),
  status TEXT NOT NULL CHECK (status IN ('active', 'revoked')),
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  updated_at INTEGER NOT NULL CHECK (updated_at >= created_at),
  expires_at INTEGER CHECK (expires_at IS NULL OR expires_at > created_at),
  last_used_at INTEGER CHECK (
    last_used_at IS NULL OR (last_used_at >= created_at AND last_used_at <= updated_at)
  ),
  revoked_at INTEGER CHECK (revoked_at IS NULL OR revoked_at = updated_at),
  CHECK ((status = 'revoked') = (revoked_at IS NOT NULL)),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);

CREATE TABLE system_notification_deliveries (
  id TEXT PRIMARY KEY NOT NULL
    CHECK (length(id) BETWEEN 1 AND 255),
  message_id TEXT NOT NULL
    REFERENCES system_notification_messages(id) ON DELETE RESTRICT,
  recipient_account_id TEXT NOT NULL
    REFERENCES system_accounts(id) ON DELETE RESTRICT,
  delivered_at INTEGER NOT NULL,
  read_at INTEGER
    CHECK (read_at IS NULL OR read_at >= delivered_at)
, dismissed_at INTEGER
  CHECK (dismissed_at IS NULL OR dismissed_at >= delivered_at),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);

CREATE TABLE system_notification_messages (
  id TEXT PRIMARY KEY NOT NULL
    CHECK (length(id) BETWEEN 1 AND 255),
  kind TEXT NOT NULL
    CHECK (length(kind) BETWEEN 3 AND 100),
  title TEXT NOT NULL
    CHECK (length(title) BETWEEN 1 AND 200),
  body TEXT
    CHECK (body IS NULL OR length(body) BETWEEN 1 AND 10000),
  source_type TEXT,
  source_id TEXT,
  created_at INTEGER NOT NULL, action_url TEXT
  CHECK (action_url IS NULL OR length(action_url) BETWEEN 1 AND 2048), priority TEXT NOT NULL DEFAULT 'normal'
  CHECK (priority IN ('low', 'normal', 'high', 'critical')), dedupe_key TEXT, action_type TEXT
  CHECK (action_type IS NULL OR length(action_type) BETWEEN 3 AND 100), action_id TEXT
  CHECK (action_id IS NULL OR length(action_id) BETWEEN 1 AND 512),
  CHECK (
    (source_type IS NULL AND source_id IS NULL) OR (
      source_type IS NOT NULL AND source_id IS NOT NULL
      AND length(source_type) BETWEEN 3 AND 100
      AND length(source_id) BETWEEN 1 AND 512
    )
  ),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);

CREATE TABLE system_notification_resource_scopes (
  message_id TEXT PRIMARY KEY NOT NULL
    REFERENCES system_notification_messages(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL
    CHECK (length(resource_type) BETWEEN 3 AND 100),
  resource_id TEXT NOT NULL
    CHECK (length(resource_id) BETWEEN 1 AND 512),
  CHECK (length(message_id) = 36 AND message_id NOT GLOB '*[^0-9a-f-]*' AND substr(message_id, 9, 1) = '-' AND substr(message_id, 14, 1) = '-' AND substr(message_id, 19, 1) = '-' AND substr(message_id, 24, 1) = '-' AND length(replace(message_id, '-', '')) = 32 AND substr(message_id, 15, 1) GLOB '[1-8]' AND substr(message_id, 20, 1) GLOB '[89ab]')
);

CREATE TABLE system_oidc_access_tokens (
  token_hash TEXT PRIMARY KEY NOT NULL
    CHECK (length(token_hash) = 64 AND token_hash NOT GLOB '*[^0-9a-f]*'),
  issuer TEXT NOT NULL,
  client_id TEXT NOT NULL,
  account_id TEXT NOT NULL
    REFERENCES system_accounts(id) ON DELETE CASCADE,
  scope TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  CHECK (expires_at > created_at)
);

CREATE TABLE system_oidc_authorization_codes (
  code_hash TEXT PRIMARY KEY NOT NULL
    CHECK (length(code_hash) = 64 AND code_hash NOT GLOB '*[^0-9a-f]*'),
  issuer TEXT NOT NULL,
  client_id TEXT NOT NULL,
  redirect_uri TEXT NOT NULL,
  account_id TEXT NOT NULL
    REFERENCES system_accounts(id) ON DELETE CASCADE,
  code_challenge TEXT NOT NULL,
  nonce TEXT NOT NULL,
  scope TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  CHECK (expires_at > created_at)
);

CREATE TABLE system_operation_receipts (
  id TEXT PRIMARY KEY NOT NULL,
  operation_key TEXT NOT NULL CHECK (length(operation_key) BETWEEN 1 AND 255),
  scope_key TEXT NOT NULL CHECK (length(scope_key) BETWEEN 1 AND 255),
  command_id TEXT NOT NULL CHECK (length(command_id) BETWEEN 1 AND 255),
  actor_account_id TEXT NOT NULL CHECK (length(actor_account_id) BETWEEN 1 AND 255),
  actor_principal_id TEXT NOT NULL CHECK (length(actor_principal_id) BETWEEN 1 AND 255),
  request_digest TEXT NOT NULL CHECK (length(request_digest) = 64 AND request_digest NOT GLOB '*[^0-9a-f]*'),
  result_json TEXT NOT NULL CHECK (json_valid(result_json) AND length(CAST(result_json AS BLOB)) <= 1000000),
  result_digest TEXT NOT NULL CHECK (length(result_digest) = 64 AND result_digest NOT GLOB '*[^0-9a-f]*'),
  recorded_at INTEGER NOT NULL CHECK (typeof(recorded_at) = 'integer' AND recorded_at >= 0 AND recorded_at <= 9007199254740991),
  UNIQUE (operation_key, scope_key, command_id),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);

CREATE TABLE system_outbox_messages (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) BETWEEN 1 AND 255),
  topic TEXT NOT NULL CHECK (length(topic) BETWEEN 1 AND 200),
  source_context TEXT NOT NULL CHECK (length(source_context) BETWEEN 1 AND 100),
  source_kind TEXT NOT NULL CHECK (length(source_kind) BETWEEN 1 AND 100),
  source_id TEXT NOT NULL CHECK (length(source_id) BETWEEN 1 AND 255),
  source_version TEXT NOT NULL CHECK (length(source_version) BETWEEN 1 AND 255),
  payload_digest TEXT NOT NULL CHECK (length(payload_digest) = 64 AND payload_digest NOT GLOB '*[^0-9a-f]*'),
  idempotency_key TEXT NOT NULL CHECK (length(idempotency_key) BETWEEN 1 AND 255),
  created_by_account_id TEXT NOT NULL REFERENCES system_accounts(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN ('queued', 'leased', 'succeeded', 'dead_letter')),
  attempt INTEGER NOT NULL CHECK (attempt BETWEEN 0 AND max_attempts),
  max_attempts INTEGER NOT NULL CHECK (max_attempts BETWEEN 1 AND 100),
  available_at INTEGER NOT NULL CHECK (available_at >= created_at),
  lease_account_id TEXT REFERENCES system_accounts(id) ON DELETE RESTRICT,
  lease_token_hash TEXT CHECK (lease_token_hash IS NULL OR (length(lease_token_hash) = 64 AND lease_token_hash NOT GLOB '*[^0-9a-f]*')),
  lease_expires_at INTEGER,
  last_error_code TEXT CHECK (last_error_code IS NULL OR length(last_error_code) BETWEEN 1 AND 200),
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  updated_at INTEGER NOT NULL CHECK (updated_at >= created_at),
  completed_at INTEGER, handler_key TEXT CHECK (handler_key IS NULL OR length(handler_key) BETWEEN 1 AND 200),
  CHECK (
    (status = 'leased' AND lease_account_id IS NOT NULL AND lease_token_hash IS NOT NULL
      AND lease_expires_at > updated_at AND completed_at IS NULL)
    OR (status = 'queued' AND lease_account_id IS NULL AND lease_token_hash IS NULL
      AND lease_expires_at IS NULL AND completed_at IS NULL)
    OR (status = 'succeeded' AND lease_account_id IS NULL AND lease_token_hash IS NULL
      AND lease_expires_at IS NULL AND completed_at = updated_at AND last_error_code IS NULL)
    OR (status = 'dead_letter' AND attempt = max_attempts
      AND lease_account_id IS NULL AND lease_token_hash IS NULL
      AND lease_expires_at IS NULL AND completed_at = updated_at AND last_error_code IS NOT NULL)
  ),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);

CREATE TABLE system_password_credentials (
  identity_id TEXT PRIMARY KEY NOT NULL
    REFERENCES system_identity_bindings(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL
    CHECK (length(password_hash) BETWEEN 20 AND 4096),
  changed_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
    CHECK (changed_at >= created_at AND updated_at >= changed_at),
  CHECK (length(identity_id) = 36 AND identity_id NOT GLOB '*[^0-9a-f-]*' AND substr(identity_id, 9, 1) = '-' AND substr(identity_id, 14, 1) = '-' AND substr(identity_id, 19, 1) = '-' AND substr(identity_id, 24, 1) = '-' AND length(replace(identity_id, '-', '')) = 32 AND substr(identity_id, 15, 1) GLOB '[1-8]' AND substr(identity_id, 20, 1) GLOB '[89ab]')
);

CREATE TABLE system_password_reset_challenges (
  id TEXT PRIMARY KEY NOT NULL,
  token_hash TEXT NOT NULL
    CHECK (length(token_hash) = 64 AND token_hash NOT GLOB '*[^0-9a-f]*'),
  account_id TEXT NOT NULL
    REFERENCES system_accounts(id) ON DELETE RESTRICT,
  identity_id TEXT NOT NULL
    REFERENCES system_identity_bindings(id) ON DELETE RESTRICT,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
    CHECK (expires_at > created_at),
  used_at INTEGER
    CHECK (used_at IS NULL OR used_at >= created_at),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);

CREATE TABLE system_preserved_records (
  id TEXT PRIMARY KEY NOT NULL,
  attachment_id TEXT NOT NULL UNIQUE REFERENCES system_attachments(id),
  preservation_id TEXT NOT NULL UNIQUE REFERENCES system_attachment_preservations(id),
  disclosure_policy_id TEXT NOT NULL,
  disclosure_policy_revision INTEGER NOT NULL,
  audit_event_id TEXT NOT NULL UNIQUE REFERENCES system_audit_events(event_id),
  snapshot_json TEXT NOT NULL CHECK (json_valid(snapshot_json)),
  FOREIGN KEY (disclosure_policy_id, disclosure_policy_revision) REFERENCES system_record_disclosure_policies(id, revision),
  CHECK (json_extract(snapshot_json, '$.id') IS id),
  CHECK (json_extract(snapshot_json, '$.attachmentId') IS attachment_id),
  CHECK (json_extract(snapshot_json, '$.preservationId') IS preservation_id),
  CHECK (json_extract(snapshot_json, '$.disclosurePolicyId') IS disclosure_policy_id),
  CHECK (json_extract(snapshot_json, '$.disclosurePolicyRevision') IS disclosure_policy_revision),
  CHECK (json_extract(snapshot_json, '$.auditEventId') IS audit_event_id),
  CHECK (json_type(snapshot_json, '$.source') IS 'object'),
  CHECK (json_type(snapshot_json, '$.sourceAuthorizationRef') IS 'object'),
  CHECK (julianday(json_extract(snapshot_json, '$.source.capturedAt')) IS NOT NULL),
  CHECK (julianday(json_extract(snapshot_json, '$.finalizedAt')) IS NOT NULL),
  CHECK (julianday(json_extract(snapshot_json, '$.source.capturedAt')) <= julianday(json_extract(snapshot_json, '$.finalizedAt'))),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);

CREATE TABLE system_principals (
  id TEXT PRIMARY KEY NOT NULL,
  legacy_id TEXT UNIQUE,
  account_id TEXT NOT NULL UNIQUE REFERENCES system_accounts(id) ON DELETE RESTRICT,
  kind TEXT NOT NULL CHECK (kind IN ('human', 'agent', 'service', 'connector')),
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 200 AND trim(name) = name),
  connector_id TEXT REFERENCES system_connectors(id) ON DELETE RESTRICT,
  revision INTEGER NOT NULL CHECK (revision >= 1),
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  updated_at INTEGER NOT NULL CHECK (updated_at >= created_at),
  CHECK ((kind = 'connector') = (connector_id IS NOT NULL)),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);

CREATE TABLE system_procedure_definition_revisions (
  -- 旧来の主キーで行を足す書込みが残るため、主キーは列の既定値でも採番する。
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
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
  UNIQUE (procedure_key, revision),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);

CREATE TABLE system_procedure_definitions (
  -- 旧来の主キーで行を足す書込みが残るため、主キーは列の既定値でも採番する。
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  key TEXT NOT NULL UNIQUE
    CHECK (
      length(key) BETWEEN 1 AND 100
      AND key NOT GLOB '*[^a-z0-9_-]*'
      AND substr(key, 1, 1) GLOB '[a-z]'
    ),
  current_revision INTEGER NOT NULL CHECK (current_revision > 0),
  status TEXT NOT NULL CHECK (status IN ('active', 'retired')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL CHECK (updated_at >= created_at),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);

CREATE TABLE system_procedure_numbers (
  number INTEGER PRIMARY KEY AUTOINCREMENT,
  procedure_key TEXT NOT NULL
    REFERENCES system_procedure_definitions(key) ON DELETE RESTRICT
);

CREATE TABLE system_proposal_cases (
  proposal_id TEXT PRIMARY KEY NOT NULL
    REFERENCES system_proposals(id) ON DELETE RESTRICT,
  case_id TEXT NOT NULL
    REFERENCES system_cases(id) ON DELETE RESTRICT,
  linked_at INTEGER NOT NULL,
  CHECK (length(proposal_id) = 36 AND proposal_id NOT GLOB '*[^0-9a-f-]*' AND substr(proposal_id, 9, 1) = '-' AND substr(proposal_id, 14, 1) = '-' AND substr(proposal_id, 19, 1) = '-' AND substr(proposal_id, 24, 1) = '-' AND length(replace(proposal_id, '-', '')) = 32 AND substr(proposal_id, 15, 1) GLOB '[1-8]' AND substr(proposal_id, 20, 1) GLOB '[89ab]')
);

CREATE TABLE system_proposal_numbers (
  number INTEGER PRIMARY KEY AUTOINCREMENT,
  series_id TEXT NOT NULL
    REFERENCES system_proposal_series(id) ON DELETE RESTRICT
);

CREATE TABLE system_proposal_series (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) BETWEEN 1 AND 255),
  procedure_key TEXT NOT NULL
    REFERENCES system_procedure_definitions(key) ON DELETE RESTRICT,
  created_by_account_id TEXT NOT NULL
    REFERENCES system_accounts(id) ON DELETE RESTRICT,
  created_at INTEGER NOT NULL,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);

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
    REFERENCES system_procedure_definition_revisions(procedure_key, revision) ON DELETE RESTRICT,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);

CREATE TABLE system_reconciliation_items (
  id TEXT PRIMARY KEY NOT NULL,
  run_id TEXT NOT NULL REFERENCES system_reconciliation_runs(id) ON DELETE RESTRICT,
  item_key TEXT NOT NULL CHECK (length(item_key) BETWEEN 1 AND 512),
  local_digest TEXT CHECK (local_digest IS NULL OR (length(local_digest) = 64 AND local_digest NOT GLOB '*[^0-9a-f]*')),
  external_digest TEXT CHECK (external_digest IS NULL OR (length(external_digest) = 64 AND external_digest NOT GLOB '*[^0-9a-f]*')),
  status TEXT NOT NULL CHECK (status IN ('matched', 'different', 'missing_local', 'missing_external')),
  UNIQUE (run_id, item_key),
  CHECK (
    (status = 'matched' AND local_digest = external_digest AND local_digest IS NOT NULL)
    OR (status = 'different' AND local_digest <> external_digest AND local_digest IS NOT NULL AND external_digest IS NOT NULL)
    OR (status = 'missing_local' AND local_digest IS NULL AND external_digest IS NOT NULL)
    OR (status = 'missing_external' AND local_digest IS NOT NULL AND external_digest IS NULL)
  ),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);

CREATE TABLE system_reconciliation_runs (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) BETWEEN 1 AND 255),
  exchange_id TEXT NOT NULL REFERENCES system_integration_exchanges(id) ON DELETE RESTRICT,
  assertion_id TEXT NOT NULL REFERENCES system_external_assertions(id) ON DELETE RESTRICT,
  local_version TEXT NOT NULL CHECK (length(local_version) BETWEEN 1 AND 255),
  status TEXT NOT NULL CHECK (status IN ('matched', 'mismatched')),
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);

CREATE TABLE system_record_coverage_entries (
  -- 照合の trigger が行を足すため、主キーは列の既定値で採番する。
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  page_id TEXT NOT NULL REFERENCES system_record_coverage_pages(id),
  freeze_id TEXT NOT NULL REFERENCES system_record_source_freezes(id),
  record_kind TEXT NOT NULL,
  source_record_id TEXT NOT NULL,
  preserved_record_id TEXT NOT NULL REFERENCES system_preserved_records(id),
  UNIQUE(freeze_id,record_kind,source_record_id),
  UNIQUE(freeze_id,preserved_record_id),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);

CREATE TABLE system_record_coverage_pages (
  id TEXT PRIMARY KEY NOT NULL,
  freeze_id TEXT NOT NULL REFERENCES system_record_source_freezes(id),
  record_kind TEXT NOT NULL,
  sequence INTEGER NOT NULL CHECK(sequence > 0),
  digest TEXT NOT NULL CHECK(length(digest)=64 AND digest NOT GLOB '*[^0-9a-f]*'),
  previous_digest TEXT,
  after_cursor TEXT,
  next_cursor TEXT,
  audit_event_id TEXT NOT NULL UNIQUE REFERENCES system_audit_events(event_id),
  snapshot_json TEXT NOT NULL CHECK(json_valid(snapshot_json)),
  UNIQUE(freeze_id,record_kind,sequence),
  UNIQUE(freeze_id,record_kind,digest),
  CHECK(json_extract(snapshot_json,'$.id') IS id),
  CHECK(json_extract(snapshot_json,'$.freezeId') IS freeze_id),
  CHECK(json_extract(snapshot_json,'$.recordKind') IS record_kind),
  CHECK(json_extract(snapshot_json,'$.sequence') IS sequence),
  CHECK(json_extract(snapshot_json,'$.previousDigest') IS previous_digest),
  CHECK(json_extract(snapshot_json,'$.afterCursor') IS after_cursor),
  CHECK(json_extract(snapshot_json,'$.nextCursor') IS next_cursor),
  CHECK(json_type(snapshot_json,'$.records') IS 'array' AND json_array_length(snapshot_json,'$.records') <= 100),
  CHECK(next_cursor IS NULL OR (length(next_cursor)>0 AND next_cursor IS NOT after_cursor AND json_array_length(snapshot_json,'$.records')>0)),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);

CREATE TABLE system_record_disclosure_policies (
  revision_id TEXT PRIMARY KEY NOT NULL,
  id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision > 0),
  record_id TEXT NOT NULL,
  audit_event_id TEXT NOT NULL UNIQUE REFERENCES system_audit_events(event_id),
  snapshot_json TEXT NOT NULL CHECK (json_valid(snapshot_json)),
  UNIQUE (id, revision),
  CHECK (json_extract(snapshot_json, '$.id') IS id),
  CHECK (json_extract(snapshot_json, '$.revision') IS revision),
  CHECK (json_extract(snapshot_json, '$.recordId') IS record_id),
  CHECK (json_extract(snapshot_json, '$.auditEventId') IS audit_event_id),
  CHECK (json_type(snapshot_json, '$.grants') IS 'array'),
  CHECK (json_extract(snapshot_json, '$.status') IS 'active' OR json_extract(snapshot_json, '$.status') IS 'revoked'),
  CHECK (julianday(json_extract(snapshot_json, '$.publishedAt')) IS NOT NULL),
  CHECK (length(revision_id) = 36 AND revision_id NOT GLOB '*[^0-9a-f-]*' AND substr(revision_id, 9, 1) = '-' AND substr(revision_id, 14, 1) = '-' AND substr(revision_id, 19, 1) = '-' AND substr(revision_id, 24, 1) = '-' AND length(replace(revision_id, '-', '')) = 32 AND substr(revision_id, 15, 1) GLOB '[1-8]' AND substr(revision_id, 20, 1) GLOB '[89ab]')
);

CREATE TABLE system_record_retirement_attachment_pins (
  -- 撤去の trigger が行を足すため、主キーは列の既定値で採番する。
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  receipt_id TEXT NOT NULL REFERENCES system_record_retirement_receipts(id),
  attachment_id TEXT NOT NULL,
  UNIQUE(receipt_id,attachment_id),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);

CREATE TABLE system_record_retirement_plans (
  id TEXT PRIMARY KEY NOT NULL,
  freeze_id TEXT NOT NULL REFERENCES system_record_source_freezes(id),
  digest TEXT NOT NULL CHECK(length(digest)=64 AND digest NOT GLOB '*[^0-9a-f]*'),
  audit_event_id TEXT NOT NULL UNIQUE REFERENCES system_audit_events(event_id),
  snapshot_json TEXT NOT NULL CHECK(json_valid(snapshot_json)),
  CHECK(json_extract(snapshot_json,'$.id') IS id),
  CHECK(json_extract(snapshot_json,'$.freezeId') IS freeze_id),
  CHECK(json_extract(snapshot_json,'$.auditEventId') IS audit_event_id),
  CHECK(json_type(snapshot_json,'$.capability.recordKinds') IS 'array'),
  CHECK(json_array_length(snapshot_json,'$.capability.recordKinds') BETWEEN 1 AND 256),
  CHECK(json_type(snapshot_json,'$.coverage') IS 'array'),
  CHECK(json_array_length(snapshot_json,'$.coverage') IS json_array_length(snapshot_json,'$.capability.recordKinds')),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);

CREATE TABLE system_record_retirement_receipts (
  id TEXT PRIMARY KEY NOT NULL,
  plan_id TEXT NOT NULL REFERENCES system_record_retirement_plans(id),
  ordinal INTEGER NOT NULL CHECK(ordinal > 0),
  digest TEXT NOT NULL CHECK(length(digest)=64 AND digest NOT GLOB '*[^0-9a-f]*'),
  coverage_page_id TEXT NOT NULL REFERENCES system_record_coverage_pages(id),
  audit_event_id TEXT NOT NULL UNIQUE REFERENCES system_audit_events(event_id),
  snapshot_json TEXT NOT NULL CHECK(json_valid(snapshot_json)),
  UNIQUE(plan_id,ordinal),
  UNIQUE(plan_id,coverage_page_id),
  CHECK(json_extract(snapshot_json,'$.id') IS id),
  CHECK(json_extract(snapshot_json,'$.planId') IS plan_id),
  CHECK(json_extract(snapshot_json,'$.ordinal') IS ordinal),
  CHECK(json_extract(snapshot_json,'$.coveragePageId') IS coverage_page_id),
  CHECK(json_extract(snapshot_json,'$.auditEventId') IS audit_event_id),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);

CREATE TABLE system_record_source_freezes (
  id TEXT PRIMARY KEY NOT NULL,
  source_namespace TEXT NOT NULL CHECK (length(source_namespace) BETWEEN 1 AND 255),
  owner_context TEXT NOT NULL CHECK (length(owner_context) BETWEEN 1 AND 100),
  revision INTEGER NOT NULL CHECK (revision IN (1, 2)),
  created_audit_event_id TEXT NOT NULL UNIQUE REFERENCES system_audit_events(event_id),
  release_audit_event_id TEXT UNIQUE REFERENCES system_audit_events(event_id),
  snapshot_json TEXT NOT NULL CHECK (json_valid(snapshot_json)),
  CHECK (json_extract(snapshot_json, '$.id') IS id),
  CHECK (json_extract(snapshot_json, '$.sourceNamespace') IS source_namespace),
  CHECK (json_extract(snapshot_json, '$.ownerContext') IS owner_context),
  CHECK (json_extract(snapshot_json, '$.revision') IS revision),
  CHECK (json_extract(snapshot_json, '$.auditEventId') IS created_audit_event_id),
  CHECK (json_type(snapshot_json, '$.actorAccountId') IS 'text'
    AND length(trim(json_extract(snapshot_json, '$.actorAccountId'))) BETWEEN 1 AND 255),
  CHECK (json_type(snapshot_json, '$.reason') IS 'text'
    AND length(trim(json_extract(snapshot_json, '$.reason'))) BETWEEN 1 AND 2000),
  CHECK (julianday(json_extract(snapshot_json, '$.createdAt')) IS NOT NULL
    AND julianday(json_extract(snapshot_json, '$.createdAt')) >= julianday('1970-01-01T00:00:00Z')),
  CHECK ((revision = 1 AND release_audit_event_id IS NULL AND json_type(snapshot_json, '$.release') IS 'null')
    OR (revision = 2 AND release_audit_event_id IS NOT NULL AND release_audit_event_id <> created_audit_event_id
      AND json_type(snapshot_json, '$.release') IS 'object'
      AND json_extract(snapshot_json, '$.release.auditEventId') IS release_audit_event_id
      AND json_type(snapshot_json, '$.release.actorAccountId') IS 'text'
      AND length(trim(json_extract(snapshot_json, '$.release.actorAccountId'))) BETWEEN 1 AND 255
      AND json_type(snapshot_json, '$.release.reason') IS 'text'
      AND length(trim(json_extract(snapshot_json, '$.release.reason'))) BETWEEN 1 AND 2000
      AND julianday(json_extract(snapshot_json, '$.release.at')) IS NOT NULL
      AND julianday(json_extract(snapshot_json, '$.release.at')) >= julianday(json_extract(snapshot_json, '$.createdAt')))),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);

CREATE TABLE system_record_source_retirements (
  id TEXT PRIMARY KEY NOT NULL,
  freeze_id TEXT NOT NULL UNIQUE REFERENCES system_record_source_freezes(id),
  plan_id TEXT NOT NULL UNIQUE REFERENCES system_record_retirement_plans(id),
  terminal_receipt_id TEXT NOT NULL REFERENCES system_record_retirement_receipts(id),
  proposal_id TEXT NOT NULL UNIQUE REFERENCES system_proposals(id),
  case_id TEXT NOT NULL UNIQUE REFERENCES system_cases(id),
  execution_authorization_id TEXT NOT NULL UNIQUE REFERENCES system_execution_authorizations(id),
  audit_event_id TEXT NOT NULL UNIQUE REFERENCES system_audit_events(event_id),
  snapshot_json TEXT NOT NULL CHECK(json_valid(snapshot_json)),
  CHECK(json_extract(snapshot_json,'$.id') IS id),
  CHECK(json_extract(snapshot_json,'$.freezeId') IS freeze_id),
  CHECK(json_extract(snapshot_json,'$.planId') IS plan_id),
  CHECK(json_extract(snapshot_json,'$.terminalReceiptId') IS terminal_receipt_id),
  CHECK(json_extract(snapshot_json,'$.proposalId') IS proposal_id),
  CHECK(json_extract(snapshot_json,'$.caseId') IS case_id),
  CHECK(json_extract(snapshot_json,'$.executionAuthorizationId') IS execution_authorization_id),
  CHECK(json_extract(snapshot_json,'$.auditEventId') IS audit_event_id),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);

CREATE TABLE system_role_bindings (
  id TEXT PRIMARY KEY NOT NULL,
  legacy_id TEXT UNIQUE,
  account_id TEXT NOT NULL
    REFERENCES system_accounts(id) ON DELETE RESTRICT,
  role_id TEXT NOT NULL
    REFERENCES system_iam_roles(id) ON DELETE RESTRICT,
  resource_type TEXT,
  resource_id TEXT,
  created_at INTEGER NOT NULL,
  revoked_at INTEGER
    CHECK (revoked_at IS NULL OR revoked_at >= created_at),
  CHECK (
    (resource_type IS NULL AND resource_id IS NULL) OR (
      resource_type IS NOT NULL AND resource_id IS NOT NULL
      AND length(resource_type) BETWEEN 3 AND 100
      AND length(resource_id) BETWEEN 1 AND 255
    )
  ),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);

CREATE TABLE system_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  account_id TEXT NOT NULL
    REFERENCES system_accounts(id) ON DELETE RESTRICT,
  family_id TEXT NOT NULL
    CHECK (length(family_id) BETWEEN 1 AND 255),
  token_hash TEXT NOT NULL
    CHECK (length(token_hash) BETWEEN 32 AND 512),
  token_version INTEGER NOT NULL
    CHECK (token_version >= 0),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
    CHECK (expires_at > created_at),
  rotated_at INTEGER
    CHECK (
      rotated_at IS NULL OR (
        rotated_at >= created_at AND rotated_at < expires_at
      )
    ),
  revoked_at INTEGER
    CHECK (
      revoked_at IS NULL OR (
        revoked_at >= created_at
        AND (rotated_at IS NULL OR revoked_at >= rotated_at)
      )
    )
, authenticated_at INTEGER
  CHECK (authenticated_at IS NULL OR authenticated_at <= created_at),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);

CREATE TABLE system_step_up_grants (
  id TEXT PRIMARY KEY NOT NULL,
  account_id TEXT NOT NULL REFERENCES system_accounts(id) ON DELETE RESTRICT,
  token_hash TEXT NOT NULL UNIQUE CHECK (
    length(token_hash) = 64 AND token_hash NOT GLOB '*[^0-9a-f]*'
  ),
  method TEXT NOT NULL CHECK (method IN ('password', 'external_identity')),
  issued_at INTEGER NOT NULL CHECK (issued_at >= 0),
  expires_at INTEGER NOT NULL CHECK (expires_at > issued_at),
  last_used_at INTEGER CHECK (
    last_used_at IS NULL OR (last_used_at >= issued_at AND last_used_at < expires_at)
  ),
  revoked_at INTEGER CHECK (
    revoked_at IS NULL OR (revoked_at >= issued_at AND revoked_at < expires_at)
  ),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);

CREATE TABLE system_work_evidence (
  attachment_id TEXT PRIMARY KEY NOT NULL REFERENCES system_attachments(id) ON DELETE RESTRICT,
  work_item_id TEXT NOT NULL REFERENCES system_work_items(id) ON DELETE RESTRICT,
  plaintext_sha256 TEXT NOT NULL CHECK (length(plaintext_sha256) = 64 AND plaintext_sha256 NOT GLOB '*[^0-9a-f]*'),
  submitted_by_account_id TEXT NOT NULL REFERENCES system_accounts(id) ON DELETE RESTRICT,
  command_id TEXT NOT NULL REFERENCES system_work_item_revisions(command_id) ON DELETE RESTRICT,
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  CHECK (length(attachment_id) = 36 AND attachment_id NOT GLOB '*[^0-9a-f-]*' AND substr(attachment_id, 9, 1) = '-' AND substr(attachment_id, 14, 1) = '-' AND substr(attachment_id, 19, 1) = '-' AND substr(attachment_id, 24, 1) = '-' AND length(replace(attachment_id, '-', '')) = 32 AND substr(attachment_id, 15, 1) GLOB '[1-8]' AND substr(attachment_id, 20, 1) GLOB '[89ab]')
);

CREATE TABLE system_work_item_revisions (
  id TEXT PRIMARY KEY NOT NULL,
  work_item_id TEXT NOT NULL REFERENCES system_work_items(id) ON DELETE RESTRICT,
  revision INTEGER NOT NULL CHECK (revision BETWEEN 1 AND 9007199254740991),
  command_id TEXT NOT NULL UNIQUE,
  action TEXT NOT NULL CHECK (action IN ('create', 'accept', 'submit', 'approve', 'return', 'request_handover', 'accept_handover', 'decline_handover', 'cancel')),
  state TEXT NOT NULL CHECK (state IN ('offered', 'active', 'review_pending', 'completed', 'cancelled')),
  actor_account_id TEXT NOT NULL REFERENCES system_accounts(id) ON DELETE RESTRICT,
  actor_principal_id TEXT NOT NULL REFERENCES system_principals(id) ON DELETE RESTRICT,
  accountable_account_id TEXT NOT NULL REFERENCES system_accounts(id) ON DELETE RESTRICT,
  accountable_principal_id TEXT NOT NULL REFERENCES system_principals(id) ON DELETE RESTRICT,
  assignee_account_id TEXT NOT NULL REFERENCES system_accounts(id) ON DELETE RESTRICT,
  assignee_principal_id TEXT NOT NULL REFERENCES system_principals(id) ON DELETE RESTRICT,
  recorded_at INTEGER NOT NULL CHECK (recorded_at >= 0),
  snapshot_json TEXT NOT NULL CHECK (json_valid(snapshot_json) AND json_type(snapshot_json) = 'object' AND length(snapshot_json) <= 100000),
  audit_event_id TEXT NOT NULL UNIQUE REFERENCES system_audit_events(event_id) ON DELETE RESTRICT,
  UNIQUE (work_item_id, revision),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);

CREATE TABLE system_work_items (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 300),
  instructions TEXT NOT NULL CHECK (length(trim(instructions)) BETWEEN 1 AND 10000),
  acceptance_criteria TEXT NOT NULL CHECK (length(trim(acceptance_criteria)) BETWEEN 1 AND 10000),
  created_by_account_id TEXT NOT NULL REFERENCES system_accounts(id) ON DELETE RESTRICT,
  created_by_principal_id TEXT NOT NULL REFERENCES system_principals(id) ON DELETE RESTRICT,
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  due_at INTEGER CHECK (due_at IS NULL OR due_at >= created_at),
  previous_revision_id TEXT REFERENCES system_work_item_revisions(command_id) ON DELETE RESTRICT,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);

CREATE INDEX company_account_employee_links_employee_idx
  ON company_account_employee_links(employee_id);

CREATE UNIQUE INDEX company_account_employee_links_employee_uniq
  ON company_account_employee_links(employee_id);

CREATE INDEX company_account_link_head_account_idx ON company_resource_heads
  (CAST(json_extract(attributes_json, '$.accountId') AS TEXT)) WHERE resource_type = 'account-employee-link';

CREATE INDEX company_account_link_head_employee_idx ON company_resource_heads
  (CAST(json_extract(attributes_json, '$.employeeId') AS TEXT)) WHERE resource_type = 'account-employee-link';

CREATE INDEX company_account_profiles_account_idx
  ON company_account_profiles (account_id);

CREATE UNIQUE INDEX company_active_collective_body_code_uniq
  ON company_resource_heads (organization_id, json_extract(attributes_json, '$.code'))
  WHERE resource_type = 'collective-body' AND state = 'active';

CREATE UNIQUE INDEX company_active_collective_body_member_uniq
  ON company_resource_heads (
    organization_id,
    json_extract(attributes_json, '$.collectiveBodyId'),
    json_extract(attributes_json, '$.employeeId')
  )
  WHERE resource_type = 'collective-body-membership' AND state = 'active';

CREATE UNIQUE INDEX company_active_job_code_uniq
  ON company_resource_heads (organization_id, json_extract(attributes_json, '$.code'))
  WHERE resource_type = 'job' AND state = 'active';

CREATE UNIQUE INDEX company_active_legal_entity_registration_uniq
  ON company_resource_heads (
    organization_id,
    json_extract(attributes_json, '$.jurisdictionCountryCode'),
    json_extract(attributes_json, '$.registrationNumber')
  )
  WHERE resource_type = 'legal-entity'
    AND state = 'active'
    AND json_extract(attributes_json, '$.registrationNumber') IS NOT NULL;

CREATE UNIQUE INDEX company_active_office_holder_uniq
  ON company_resource_heads (
    organization_id,
    json_extract(attributes_json, '$.organizationalOfficeId')
  )
  WHERE resource_type = 'office-assignment' AND state = 'active';

CREATE UNIQUE INDEX company_active_organizational_office_code_uniq
  ON company_resource_heads (organization_id, json_extract(attributes_json, '$.code'))
  WHERE resource_type = 'organizational-office' AND state = 'active';

CREATE UNIQUE INDEX company_active_site_code_uniq
  ON company_resource_heads (organization_id, json_extract(attributes_json, '$.code'))
  WHERE resource_type = 'site' AND state = 'active';

CREATE UNIQUE INDEX company_active_workplace_code_uniq
  ON company_resource_heads (
    organization_id,
    json_extract(attributes_json, '$.siteId'),
    json_extract(attributes_json, '$.code')
  )
  WHERE resource_type = 'workplace' AND state = 'active';

CREATE INDEX company_assignment_period_bindings_resource_idx ON company_assignment_period_bindings(resource_id);

CREATE INDEX company_assignment_resource_bindings_employee_idx ON company_assignment_resource_bindings(employee_id);

CREATE UNIQUE INDEX company_employees_employee_code_uniq
  ON company_employees(employee_code);

CREATE INDEX company_employment_attributes_employment_idx
  ON company_employment_attributes(employment_id);

CREATE UNIQUE INDEX company_employments_employee_active_unique
  ON company_employments(employee_id)
  WHERE termination_date IS NULL AND status IN ('ACTIVE', 'ON_LEAVE');

CREATE INDEX company_employments_employee_idx
  ON company_employments(employee_id);

CREATE INDEX company_employments_status_idx
  ON company_employments(status);

CREATE INDEX company_organization_assignment_period_versions_employee_idx
  ON company_organization_assignment_period_versions(
    employee_id, starts_on, ends_on, assignment_type, period_id, revision
  );

CREATE INDEX company_organization_assignment_period_versions_unit_idx
  ON company_organization_assignment_period_versions(
    organization_unit_id, starts_on, ends_on, period_id, revision
  );

CREATE INDEX company_organization_responsibility_period_versions_employee_idx
  ON company_organization_responsibility_period_versions(
    employee_id, starts_on, ends_on, period_id, revision
  );

CREATE INDEX company_organization_responsibility_period_versions_unit_idx
  ON company_organization_responsibility_period_versions(
    organization_unit_id, responsibility_type, starts_on, ends_on, period_id, revision
  );

CREATE INDEX company_organization_unit_period_versions_code_idx
  ON company_organization_unit_period_versions(code, starts_on, ends_on, period_id, revision);

CREATE INDEX company_organization_unit_period_versions_parent_idx
  ON company_organization_unit_period_versions(parent_organization_unit_id, starts_on, ends_on);

CREATE INDEX company_organization_unit_period_versions_unit_idx
  ON company_organization_unit_period_versions(
    organization_unit_id, starts_on, ends_on, period_id, revision
  );

CREATE UNIQUE INDEX company_profile_organization_identity ON company_resource_heads (organization_id) WHERE resource_type = 'company-profile';

CREATE UNIQUE INDEX company_resource_heads_org_revision_idx
  ON company_resource_heads (organization_id, organization_revision, resource_type, resource_id);

CREATE INDEX company_resource_heads_type_effective_idx
  ON company_resource_heads (organization_id, resource_type, effective_from, effective_to);

CREATE INDEX `company_resource_revisions_account_link_idx`
  ON `company_resource_revisions` (`organization_id`, `resource_id`)
  WHERE `resource_type` = 'account-employee-link';

CREATE INDEX company_resource_revisions_command_idx
  ON company_resource_revisions (organization_id, command_id);

CREATE INDEX company_resource_revisions_correction_idx
  ON company_resource_revisions (
    organization_id, resource_type, resource_id, corrects_revision, organization_revision
  )
  WHERE corrects_revision IS NOT NULL;

CREATE INDEX company_resource_revisions_org_revision_idx
  ON company_resource_revisions (organization_id, organization_revision, resource_type, resource_id);

CREATE INDEX company_responsibility_period_bindings_resource_idx ON company_responsibility_period_bindings(resource_id);

CREATE INDEX company_responsibility_resource_bindings_employee_idx ON company_responsibility_resource_bindings(employee_id);

CREATE UNIQUE INDEX company_single_active_profile_uniq
  ON company_resource_heads (organization_id)
  WHERE resource_type = 'company-profile' AND state = 'active';

CREATE INDEX company_workforce_resource_bindings_employee_idx
  ON company_workforce_resource_bindings(employee_id, resource_type);

CREATE INDEX idx_company_audit_event_employee_contexts_employee
  ON company_audit_event_employee_contexts(employee_id, audit_event_id);

CREATE INDEX idx_company_audit_events_action
  ON company_audit_events(action, created_at, id);

CREATE INDEX idx_company_audit_events_actor
  ON company_audit_events(actor_account_id, created_at, id);

CREATE INDEX idx_company_audit_events_created
  ON company_audit_events(created_at, id);

CREATE INDEX idx_company_audit_events_outcome
  ON company_audit_events(outcome, created_at, id);

CREATE INDEX idx_company_audit_events_request
  ON company_audit_events(request_id);

CREATE INDEX idx_company_audit_events_target
  ON company_audit_events(target_type, target_id, created_at, id);

CREATE INDEX idx_company_employee_status_period_versions_employee
  ON company_employee_status_period_versions(
    employee_id, starts_on, ends_on, period_id, revision DESC
  );

CREATE INDEX idx_company_employee_status_period_versions_employment
  ON company_employee_status_period_versions(employment_period_id, period_id, revision DESC);

CREATE INDEX idx_company_employment_period_versions_employee
  ON company_employment_period_versions(
    employee_id, starts_on, ends_on, period_id, revision DESC
  );

CREATE INDEX idx_company_lifecycle_outbox_pending
  ON company_lifecycle_outbox_entries(processed_at, next_attempt_at, id);

CREATE INDEX idx_company_personnel_action_requests_target
  ON company_personnel_action_requests(target_employee_id, created_at, id);

CREATE INDEX idx_company_personnel_actions_employee_timeline
  ON company_personnel_actions(employee_id, event_on, recorded_at, id);

CREATE INDEX idx_company_personnel_annotations_employee ON company_personnel_annotations(employee_id);

CREATE INDEX idx_company_personnel_annotations_kind ON company_personnel_annotations(kind);

CREATE INDEX idx_system_attachments_created_at
  ON system_attachments (created_at);

CREATE INDEX idx_system_attachments_owner_status
  ON system_attachments (owner_account_id, status);

CREATE INDEX system_account_invitations_resource_idx
  ON system_account_invitations (resource_type, resource_id);

CREATE INDEX system_account_invitations_role_idx
  ON system_account_invitations(role_id, created_at);

CREATE INDEX system_account_invitations_subject_idx
  ON system_account_invitations(subject, created_at);

CREATE UNIQUE INDEX system_account_invitations_token_uniq
  ON system_account_invitations(token);

CREATE INDEX system_attachment_preservations_target_idx ON system_attachment_preservations(attachment_id, id);

CREATE UNIQUE INDEX system_audit_disclosure_scope_revision_uniq
  ON system_audit_disclosure_policy_revisions (scope, revision);

CREATE INDEX system_audit_events_action_idx
  ON system_audit_events (action, occurred_at);

CREATE INDEX system_audit_events_actor_idx
  ON system_audit_events (actor_account_id, occurred_at);

CREATE INDEX system_audit_events_outcome_idx
  ON system_audit_events (outcome, occurred_at);

CREATE INDEX system_audit_events_target_idx
  ON system_audit_events (target_type, target_id, occurred_at);

CREATE INDEX system_authentication_attempts_identifier_attempted_at_idx
  ON system_authentication_attempts (identifier, attempted_at);

CREATE INDEX system_authentication_attempts_ip_attempted_at_idx
  ON system_authentication_attempts (ip, attempted_at);

CREATE INDEX system_batch_jobs_status_idx
  ON system_batch_jobs (status, id);

CREATE INDEX system_browser_login_codes_expires_idx
  ON system_browser_login_codes (expires_at);

CREATE INDEX system_cases_creator_idx
  ON system_cases (created_by_account_id, created_at);

CREATE INDEX system_cases_status_idx
  ON system_cases (status, updated_at);

CREATE INDEX system_cases_subject_idx
  ON system_cases (subject_context, subject_kind, subject_id, subject_version);

CREATE INDEX system_cli_login_codes_expires_idx
  ON system_cli_login_codes (expires_at);

CREATE INDEX system_cli_login_states_expires_idx
  ON system_cli_login_states (expires_at);

CREATE INDEX system_connectors_status_idx ON system_connectors (status, key);

CREATE INDEX system_dead_letters_recorded_idx ON system_dead_letters (recorded_at, id);

CREATE UNIQUE INDEX system_dead_letters_source_uniq ON system_dead_letters (source_type, source_id);

CREATE INDEX system_decision_task_candidates_account_idx
  ON system_decision_task_candidates (candidate_account_id, resolved_at);

CREATE UNIQUE INDEX system_decision_task_candidates_account_uniq
  ON system_decision_task_candidates (case_id, task_key, round, candidate_account_id);

CREATE INDEX system_decision_task_exclusions_account_idx
  ON system_decision_task_exclusions (excluded_account_id);

CREATE INDEX system_decision_tasks_open_idx
  ON system_decision_tasks (due_at, opened_at)
  WHERE closed_at IS NULL;

CREATE UNIQUE INDEX system_delegation_numbers_delegation_uniq
  ON system_delegation_numbers (delegation_id);

CREATE UNIQUE INDEX system_delegation_procedure_scopes_pair_uniq
  ON system_delegation_procedure_scopes (delegation_id, procedure_key);

CREATE INDEX system_delegations_delegate_idx
  ON system_delegations (delegate_account_id, starts_at);

CREATE INDEX system_delegations_delegator_idx
  ON system_delegations (delegator_account_id, starts_at);

CREATE UNIQUE INDEX system_execution_authorizations_case_operation_uniq
  ON system_execution_authorizations (case_id, operation_key);

CREATE INDEX system_execution_authorizations_grantee_idx
  ON system_execution_authorizations (granted_to_account_id, granted_at);

CREATE INDEX system_external_assertions_exchange_idx
  ON system_external_assertions (exchange_id, received_at);

CREATE UNIQUE INDEX system_external_assertions_version_uniq
  ON system_external_assertions (connector_id, external_key, external_version);

CREATE UNIQUE INDEX system_human_attestations_actor_uniq
  ON system_human_attestations (case_id, task_key, round, actor_account_id);

CREATE INDEX system_human_attestations_decided_idx
  ON system_human_attestations (decided_at);

CREATE UNIQUE INDEX system_human_attestations_represented_uniq
  ON system_human_attestations (case_id, task_key, round, represented_account_id);

CREATE UNIQUE INDEX system_iam_roles_key_uniq
  ON system_iam_roles (key);

CREATE INDEX system_identity_bindings_account_idx
  ON system_identity_bindings (account_id);

CREATE UNIQUE INDEX system_identity_bindings_provider_subject_uniq
  ON system_identity_bindings (provider, subject);

CREATE INDEX system_identity_login_tokens_expires_idx
  ON system_identity_login_tokens (expires_at);

CREATE INDEX system_identity_profiles_email_idx
  ON system_identity_profiles (email);

CREATE UNIQUE INDEX system_inbox_messages_external_uniq
  ON system_inbox_messages (source_key, external_message_id);

CREATE INDEX system_inbox_messages_status_idx ON system_inbox_messages (status, received_at);

CREATE UNIQUE INDEX system_integration_exchanges_idempotency_uniq
  ON system_integration_exchanges (connector_id, idempotency_key);

CREATE INDEX system_integration_exchanges_status_idx
  ON system_integration_exchanges (connector_id, status, updated_at);

CREATE INDEX system_jobs_claim_idx ON system_jobs (status, available_at, id);

CREATE INDEX system_jobs_handler_claim_idx ON system_jobs(handler_key, status, available_at, id);

CREATE UNIQUE INDEX system_jobs_idempotency_uniq ON system_jobs (operation_key, idempotency_key);

CREATE INDEX system_jobs_lease_idx ON system_jobs (status, lease_expires_at);

CREATE INDEX system_machine_credentials_expiration_idx
  ON system_machine_credentials (expires_at);

CREATE INDEX system_machine_credentials_principal_idx
  ON system_machine_credentials (principal_id, status);

CREATE INDEX system_notification_deliveries_account_idx
  ON system_notification_deliveries (recipient_account_id, delivered_at);

CREATE UNIQUE INDEX system_notification_deliveries_message_account_uniq
  ON system_notification_deliveries (message_id, recipient_account_id);

CREATE INDEX system_notification_deliveries_unread_idx
  ON system_notification_deliveries (recipient_account_id, delivered_at)
  WHERE read_at IS NULL AND dismissed_at IS NULL;

CREATE UNIQUE INDEX system_notification_messages_dedupe_key_uniq
  ON system_notification_messages(dedupe_key);

CREATE INDEX system_notification_messages_priority_idx
  ON system_notification_messages(priority, created_at);

CREATE INDEX system_notification_messages_source_idx
  ON system_notification_messages (source_type, source_id);

CREATE INDEX system_notification_resource_scopes_resource_idx
  ON system_notification_resource_scopes (resource_type, resource_id, message_id);

CREATE INDEX system_oidc_access_tokens_expires_idx
  ON system_oidc_access_tokens (expires_at);

CREATE INDEX system_oidc_authorization_codes_expires_idx
  ON system_oidc_authorization_codes (expires_at);

CREATE INDEX system_operation_receipts_actor_idx ON system_operation_receipts (actor_account_id, recorded_at);

CREATE INDEX system_outbox_handler_claim_idx ON system_outbox_messages(handler_key, status, available_at, id);

CREATE INDEX system_outbox_messages_claim_idx ON system_outbox_messages (status, available_at, id);

CREATE UNIQUE INDEX system_outbox_messages_idempotency_uniq
  ON system_outbox_messages (topic, idempotency_key);

CREATE INDEX system_outbox_messages_lease_idx ON system_outbox_messages (status, lease_expires_at);

CREATE INDEX system_password_reset_challenges_account_idx
  ON system_password_reset_challenges (account_id, created_at);

CREATE INDEX system_password_reset_challenges_expires_idx
  ON system_password_reset_challenges (expires_at);

CREATE UNIQUE INDEX system_password_reset_challenges_token_hash_uniq
  ON system_password_reset_challenges (token_hash);

CREATE INDEX system_preserved_records_source_idx ON system_preserved_records (
  json_extract(snapshot_json, '$.source.sourceNamespace'),
  json_extract(snapshot_json, '$.source.ownerContext'),
  json_extract(snapshot_json, '$.source.recordKind'),
  json_extract(snapshot_json, '$.source.recordId')
);

CREATE UNIQUE INDEX system_principals_connector_uniq ON system_principals (connector_id);

CREATE INDEX system_principals_kind_idx ON system_principals (kind, id);

CREATE INDEX system_procedure_definition_revisions_creator_idx
  ON system_procedure_definition_revisions (created_by_account_id, created_at);

CREATE INDEX system_procedure_definitions_status_idx
  ON system_procedure_definitions (status, updated_at);

CREATE UNIQUE INDEX system_procedure_numbers_key_uniq
  ON system_procedure_numbers (procedure_key);

CREATE UNIQUE INDEX system_proposal_cases_case_uniq
  ON system_proposal_cases (case_id);

CREATE UNIQUE INDEX system_proposal_numbers_series_uniq
  ON system_proposal_numbers (series_id);

CREATE INDEX system_proposal_series_creator_idx
  ON system_proposal_series (created_by_account_id, created_at);

CREATE INDEX system_proposal_series_definition_idx
  ON system_proposal_series (procedure_key, created_at);

CREATE INDEX system_proposals_creator_idx
  ON system_proposals (created_by_account_id, created_at);

CREATE INDEX system_proposals_definition_idx
  ON system_proposals (procedure_key, procedure_revision);

CREATE UNIQUE INDEX system_proposals_series_version_uniq
  ON system_proposals (series_id, version);

CREATE UNIQUE INDEX system_reconciliation_runs_input_uniq
  ON system_reconciliation_runs (exchange_id, assertion_id, local_version);

CREATE INDEX system_reconciliation_runs_status_idx
  ON system_reconciliation_runs (status, created_at);

CREATE UNIQUE INDEX system_record_coverage_pages_cursor_idx
  ON system_record_coverage_pages(freeze_id,record_kind,after_cursor) WHERE after_cursor IS NOT NULL;

CREATE INDEX system_record_retirement_attachment_pins_attachment_idx
  ON system_record_retirement_attachment_pins(attachment_id,receipt_id);

CREATE UNIQUE INDEX system_record_source_freezes_active_owner_idx
  ON system_record_source_freezes(owner_context) WHERE revision = 1;

CREATE INDEX system_role_bindings_account_idx
  ON system_role_bindings (account_id, created_at);

CREATE UNIQUE INDEX system_role_bindings_active_uniq
  ON system_role_bindings (
    account_id,
    role_id,
    coalesce(resource_type, ''),
    coalesce(resource_id, '')
  )
  WHERE revoked_at IS NULL;

CREATE INDEX system_role_bindings_resource_idx
  ON system_role_bindings (resource_type, resource_id);

CREATE INDEX system_role_bindings_role_idx
  ON system_role_bindings (role_id, created_at);

CREATE INDEX system_sessions_account_idx
  ON system_sessions (account_id, created_at);

CREATE INDEX system_sessions_active_family_idx
  ON system_sessions (family_id) WHERE revoked_at IS NULL;

CREATE UNIQUE INDEX system_sessions_token_hash_uniq
  ON system_sessions (token_hash);

CREATE INDEX system_step_up_grants_account_idx
  ON system_step_up_grants (account_id, expires_at);

CREATE INDEX system_work_evidence_work_idx ON system_work_evidence(work_item_id, attachment_id);

CREATE INDEX system_work_items_accountable_idx ON system_work_item_revisions(accountable_account_id, work_item_id, revision);

CREATE INDEX system_work_items_assignee_idx ON system_work_item_revisions(assignee_account_id, work_item_id, revision);

CREATE UNIQUE INDEX uq_company_calendar_days_date ON company_calendar_days (calendar_date);

CREATE UNIQUE INDEX uq_company_lifecycle_outbox_action_effect
  ON company_lifecycle_outbox_entries(personnel_action_id, effect_type);

CREATE UNIQUE INDEX uq_company_personnel_action_requests_applied_action
  ON company_personnel_action_requests(applied_action_id)
  WHERE applied_action_id IS NOT NULL;

CREATE UNIQUE INDEX uq_company_personnel_action_requests_system_series
  ON company_personnel_action_requests(system_proposal_series_id)
  WHERE system_proposal_series_id IS NOT NULL;

CREATE UNIQUE INDEX uq_company_personnel_actions_correction
  ON company_personnel_actions(corrects_action_id)
  WHERE corrects_action_id IS NOT NULL;

CREATE UNIQUE INDEX uq_company_personnel_actions_source_application
  ON company_personnel_actions(source_application_id)
  WHERE source_application_id IS NOT NULL;

CREATE VIEW company_account_employee_link_period_violations AS
WITH effective_versions AS (
  SELECT resource.* FROM company_resource_revisions resource
  WHERE resource.resource_type = 'employee' AND resource.revision = (
    SELECT max(latest.revision) FROM company_resource_revisions latest
    WHERE latest.organization_id = resource.organization_id AND latest.resource_type = resource.resource_type
      AND latest.resource_id = resource.resource_id AND latest.effective_from = resource.effective_from
  )
), next_versions AS (
  SELECT *, lead(effective_from) OVER (PARTITION BY organization_id, resource_id ORDER BY effective_from) AS next_from
  FROM effective_versions
), periods AS (
  SELECT organization_id, resource_id AS employee_id, effective_from AS starts_on,
    CASE WHEN next_from IS NULL OR (effective_to IS NOT NULL AND effective_to < next_from)
      THEN effective_to ELSE next_from END AS ends_on
  FROM next_versions WHERE state = 'active'
), prior AS (
  SELECT *, max(coalesce(ends_on, '9999-12-31')) OVER (
    PARTITION BY organization_id, employee_id ORDER BY starts_on, ends_on
    ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) AS covered_until
  FROM periods
), groups AS (
  SELECT *, sum(CASE WHEN covered_until IS NULL OR starts_on > covered_until THEN 1 ELSE 0 END) OVER (
    PARTITION BY organization_id, employee_id ORDER BY starts_on, ends_on ROWS UNBOUNDED PRECEDING) AS island
  FROM prior
), coverage AS (
  SELECT organization_id, employee_id, min(starts_on) AS starts_on,
    CASE WHEN max(ends_on IS NULL) = 1 THEN NULL ELSE max(ends_on) END AS ends_on
  FROM groups GROUP BY organization_id, employee_id, island
)
SELECT link.* FROM company_account_employee_link_periods link WHERE link.source = 'public'
  AND NOT EXISTS (SELECT 1 FROM coverage
    WHERE coverage.organization_id = 'ad4f6cb1-774b-43ae-950f-80e9bc67c66d' AND coverage.employee_id = link.employee_id
      AND coverage.starts_on <= link.starts_on
      AND (coverage.ends_on IS NULL OR (link.ends_on IS NOT NULL AND link.ends_on <= coverage.ends_on)));

CREATE VIEW company_account_employee_link_periods AS
WITH effective_versions AS (
  SELECT resource.*, (
    SELECT min(later.effective_from) FROM company_resource_revisions later
    WHERE later.organization_id = resource.organization_id AND later.resource_type = resource.resource_type
      AND later.resource_id = resource.resource_id AND later.effective_from > resource.effective_from
  ) AS next_from FROM company_resource_revisions resource
  WHERE resource.resource_type = 'account-employee-link' AND resource.revision = (
    SELECT max(latest.revision) FROM company_resource_revisions latest
    WHERE latest.organization_id = resource.organization_id AND latest.resource_type = resource.resource_type
      AND latest.resource_id = resource.resource_id AND latest.effective_from = resource.effective_from
  )
)
SELECT binding.account_id, binding.employee_id, resource.effective_from AS starts_on,
  CASE WHEN resource.next_from IS NULL OR (resource.effective_to IS NOT NULL AND resource.effective_to < resource.next_from)
    THEN resource.effective_to ELSE resource.next_from END AS ends_on,
  binding.resource_id, resource.revision, resource.organization_revision, 'public' AS source
FROM effective_versions resource
JOIN company_account_employee_resource_bindings binding
  ON binding.organization_id = resource.organization_id AND binding.resource_id = resource.resource_id
WHERE resource.state = 'active'
UNION ALL
SELECT original.account_id, original.employee_id, NULL, NULL, NULL, NULL, NULL, 'legacy'
FROM company_account_employee_links original
WHERE NOT EXISTS (SELECT 1 FROM company_account_employee_resource_bindings binding
  WHERE binding.account_id = original.account_id OR binding.employee_id = original.employee_id)
  AND NOT EXISTS (SELECT 1 FROM company_resource_heads resource WHERE resource.resource_type = 'account-employee-link'
    AND CAST(json_extract(resource.attributes_json, '$.accountId') AS TEXT) = original.account_id)
  AND NOT EXISTS (SELECT 1 FROM company_resource_heads resource WHERE resource.resource_type = 'account-employee-link'
    AND CAST(json_extract(resource.attributes_json, '$.employeeId') AS TEXT) = original.employee_id);

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

CREATE VIEW company_employment_authority_violations AS
WITH effective_versions AS (
  SELECT resource.* FROM company_resource_revisions resource
  WHERE resource.resource_type IN ('office-assignment', 'organizational-authority',
      'responsibility-assignment', 'collective-body-membership')
    AND resource.revision = (
      SELECT max(latest.revision) FROM company_resource_revisions latest
      WHERE latest.organization_id = resource.organization_id AND latest.resource_type = resource.resource_type
        AND latest.resource_id = resource.resource_id AND latest.effective_from = resource.effective_from
    )
), next_versions AS (
  SELECT *, lead(effective_from) OVER (
    PARTITION BY organization_id, resource_type, resource_id ORDER BY effective_from
  ) AS next_from FROM effective_versions
), appointments AS (
  SELECT organization_id, resource_type, resource_id,
    CASE WHEN resource_type = 'responsibility-assignment'
      THEN json_extract(attributes_json, '$.holderId')
      ELSE json_extract(attributes_json, '$.employeeId') END AS employee_id,
    json_extract(attributes_json, '$.employmentId') AS employment_id,
    json_extract(attributes_json, '$.scopeType') AS scope_type,
    json_extract(attributes_json, '$.scopeId') AS scope_id,
    effective_from AS starts_on,
    CASE WHEN next_from IS NULL OR (effective_to IS NOT NULL AND effective_to < next_from)
      THEN effective_to ELSE next_from END AS ends_on
  FROM next_versions WHERE state = 'active'
    AND (resource_type != 'responsibility-assignment' OR json_extract(attributes_json, '$.holderType') = 'employee')
), periods AS (
  SELECT binding.organization_id, period.employee_id, period.period_id AS employment_id,
    'employment' AS kind, NULL AS scope_id, period.starts_on, period.ends_on
  FROM company_employment_period_versions period
  JOIN company_workforce_resource_bindings binding
    ON binding.resource_type = 'employee' AND binding.resource_id = period.employee_id
  WHERE period.is_void = 0 AND period.revision = (SELECT max(latest.revision)
    FROM company_employment_period_versions latest WHERE latest.period_id = period.period_id)
  UNION ALL
  SELECT binding.organization_id, period.employee_id, NULL AS employment_id,
    'employment' AS kind, NULL AS scope_id, period.starts_on, period.ends_on
  FROM company_employment_period_versions period
  JOIN company_workforce_resource_bindings binding
    ON binding.resource_type = 'employee' AND binding.resource_id = period.employee_id
  WHERE period.is_void = 0 AND period.revision = (SELECT max(latest.revision)
    FROM company_employment_period_versions latest WHERE latest.period_id = period.period_id)
  UNION ALL
  SELECT binding.organization_id, period.employee_id, period.employment_id,
    'assignment', period.organization_unit_id, period.starts_on, period.ends_on
  FROM company_organization_assignment_coverage period
  JOIN company_workforce_resource_bindings binding
    ON binding.resource_type = 'employee' AND binding.resource_id = period.employee_id
  UNION ALL
  SELECT binding.organization_id, period.employee_id, period.employment_id,
    'assignment', NULL, period.starts_on, period.ends_on
  FROM company_organization_assignment_coverage period
  JOIN company_workforce_resource_bindings binding
    ON binding.resource_type = 'employee' AND binding.resource_id = period.employee_id
), prior AS (
  SELECT *, max(coalesce(ends_on, '9999-12-31')) OVER (
    PARTITION BY organization_id, employee_id, employment_id, kind, scope_id
    ORDER BY starts_on, ends_on ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
  ) AS covered_until FROM periods
), islands AS (
  SELECT *, sum(CASE WHEN covered_until IS NULL OR starts_on > covered_until THEN 1 ELSE 0 END) OVER (
    PARTITION BY organization_id, employee_id, employment_id, kind, scope_id
    ORDER BY starts_on, ends_on ROWS UNBOUNDED PRECEDING
  ) AS island FROM prior
), coverage AS (
  SELECT organization_id, employee_id, employment_id, kind, scope_id, min(starts_on) AS starts_on,
    CASE WHEN max(ends_on IS NULL) = 1 THEN NULL ELSE max(ends_on) END AS ends_on
  FROM islands GROUP BY organization_id, employee_id, employment_id, kind, scope_id, island
)
SELECT appointment.* FROM appointments appointment WHERE
  NOT EXISTS (
    SELECT 1 FROM coverage WHERE coverage.organization_id = appointment.organization_id
      AND coverage.employee_id = appointment.employee_id AND coverage.employment_id IS appointment.employment_id
      AND coverage.kind = 'employment' AND coverage.starts_on <= appointment.starts_on
      AND (coverage.ends_on IS NULL OR (appointment.ends_on IS NOT NULL AND appointment.ends_on <= coverage.ends_on))
  ) OR (appointment.resource_type = 'organizational-authority' AND NOT EXISTS (
    SELECT 1 FROM coverage WHERE coverage.organization_id = appointment.organization_id
      AND coverage.employee_id = appointment.employee_id AND coverage.employment_id IS appointment.employment_id
      AND coverage.kind = 'assignment' AND coverage.starts_on <= appointment.starts_on
      AND (coverage.ends_on IS NULL OR (appointment.ends_on IS NOT NULL AND appointment.ends_on <= coverage.ends_on))
      AND ((appointment.scope_type = 'organization-unit' AND coverage.scope_id = appointment.scope_id)
        OR (appointment.scope_type = 'authority-scope' AND coverage.scope_id IS NULL))
  ));

CREATE VIEW company_employment_contract_term_violations AS
SELECT organization_id, resource_id, revision
FROM company_resource_revisions
WHERE resource_type = 'employment'
  AND json_type(attributes_json, '$.contractTerm') IS NOT NULL
  AND json_type(attributes_json, '$.contractTerm') <> 'null'
  AND NOT coalesce(
    json_type(attributes_json, '$.contractTerm') = 'object'
    AND json_type(attributes_json, '$.contractTerm.kind') = 'text'
    AND json_type(attributes_json, '$.contractTerm.startsOn') = 'text'
    AND json_extract(attributes_json, '$.contractTerm.startsOn') GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
    AND date(json_extract(attributes_json, '$.contractTerm.startsOn'), '+0 days') = json_extract(attributes_json, '$.contractTerm.startsOn')
    AND (
      (
        json_extract(attributes_json, '$.contractTerm.kind') = 'INDEFINITE'
        AND (SELECT count(*) FROM json_each(attributes_json, '$.contractTerm')) = 2
        AND NOT EXISTS (SELECT 1 FROM json_each(attributes_json, '$.contractTerm') WHERE key NOT IN ('kind', 'startsOn'))
      )
      OR (
        json_extract(attributes_json, '$.contractTerm.kind') = 'FIXED_TERM'
        AND (SELECT count(*) FROM json_each(attributes_json, '$.contractTerm')) = 3
        AND NOT EXISTS (SELECT 1 FROM json_each(attributes_json, '$.contractTerm') WHERE key NOT IN ('kind', 'startsOn', 'endsBefore'))
        AND json_type(attributes_json, '$.contractTerm.endsBefore') = 'text'
        AND json_extract(attributes_json, '$.contractTerm.endsBefore') GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
        AND date(json_extract(attributes_json, '$.contractTerm.endsBefore'), '+0 days') = json_extract(attributes_json, '$.contractTerm.endsBefore')
        AND json_extract(attributes_json, '$.contractTerm.startsOn') < json_extract(attributes_json, '$.contractTerm.endsBefore')
      )
    ), 0
  );

CREATE VIEW company_employment_employer_reference_violations AS
SELECT employment.organization_id, employment.resource_id, employment.starts_on, employment.ends_on,
  json_extract(employment.attributes_json, '$.employerLegalEntityId') AS employer_legal_entity_id
FROM company_governance_resource_periods employment
WHERE employment.resource_type = 'employment'
  AND json_type(employment.attributes_json, '$.employerLegalEntityId') IS NOT NULL
  AND json_type(employment.attributes_json, '$.employerLegalEntityId') <> 'null'
  AND (
    json_type(employment.attributes_json, '$.employerLegalEntityId') <> 'text'
    OR NOT EXISTS (
      SELECT 1 FROM company_resource_revisions identity
      WHERE identity.organization_id = employment.organization_id
        AND identity.resource_type = 'legal-entity' AND identity.state = 'active'
        AND identity.resource_id = json_extract(employment.attributes_json, '$.employerLegalEntityId')
    )
    OR (
      json_extract(employment.attributes_json, '$.status') IN ('ACTIVE', 'ON_LEAVE')
      AND NOT EXISTS (
        SELECT 1 FROM company_governance_resource_coverage employer
        WHERE employer.organization_id = employment.organization_id AND employer.resource_type = 'legal-entity'
          AND employer.reference_id = json_extract(employment.attributes_json, '$.employerLegalEntityId')
          AND employer.starts_on <= employment.starts_on
          AND (employer.ends_on IS NULL OR (employment.ends_on IS NOT NULL AND employment.ends_on <= employer.ends_on))
      )
    )
  );

CREATE VIEW company_governance_organization_reference_violations AS
SELECT DISTINCT organization_id, resource_type, resource_id
FROM company_governance_reference_period_violations
WHERE resource_type = 'organizational-office'
  OR (resource_type = 'authority-scope' AND target_type = 'organization-unit');

CREATE VIEW company_governance_organization_unit_coverage AS
WITH periods AS (
  SELECT organization_id, json_extract(attributes_json, '$.organizationUnitId') AS organization_unit_id,
    effective_from AS starts_on, effective_to AS ends_on
  FROM company_resource_heads WHERE resource_type = 'organization-unit' AND state = 'active'
), prior AS (
  SELECT *, max(coalesce(ends_on, '9999-12-31')) OVER (
    PARTITION BY organization_id, organization_unit_id
    ORDER BY starts_on, ends_on ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
  ) AS covered_until FROM periods
), islands AS (
  SELECT *, sum(CASE WHEN covered_until IS NULL OR starts_on > covered_until THEN 1 ELSE 0 END) OVER (
    PARTITION BY organization_id, organization_unit_id ORDER BY starts_on, ends_on
    ROWS UNBOUNDED PRECEDING
  ) AS island FROM prior
)
SELECT organization_id, organization_unit_id, min(starts_on) AS starts_on,
  CASE WHEN max(ends_on IS NULL) = 1 THEN NULL ELSE max(ends_on) END AS ends_on
FROM islands GROUP BY organization_id, organization_unit_id, island;

CREATE VIEW company_governance_reference_period_violations AS
SELECT reference.* FROM company_governance_resource_references reference
WHERE NOT EXISTS (
  SELECT 1 FROM company_governance_resource_coverage target
  WHERE target.organization_id = reference.organization_id AND target.resource_type = reference.target_type
    AND target.reference_id = reference.target_id AND target.starts_on <= reference.starts_on
    AND (target.ends_on IS NULL OR (reference.ends_on IS NOT NULL AND reference.ends_on <= target.ends_on))
);

CREATE VIEW company_governance_resource_coverage AS
WITH prior AS (
  SELECT *, max(coalesce(ends_on, '9999-12-31')) OVER (
    PARTITION BY organization_id, resource_type, reference_id
    ORDER BY starts_on, ends_on ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
  ) AS covered_until FROM company_governance_resource_periods
), islands AS (
  SELECT *, sum(CASE WHEN covered_until IS NULL OR starts_on > covered_until THEN 1 ELSE 0 END) OVER (
    PARTITION BY organization_id, resource_type, reference_id ORDER BY starts_on, ends_on
    ROWS UNBOUNDED PRECEDING
  ) AS island FROM prior
)
SELECT organization_id, resource_type, reference_id, min(starts_on) AS starts_on,
  CASE WHEN max(ends_on IS NULL) = 1 THEN NULL ELSE max(ends_on) END AS ends_on
FROM islands GROUP BY organization_id, resource_type, reference_id, island;

CREATE VIEW company_governance_resource_periods AS
WITH effective_versions AS (
  SELECT resource.* FROM company_resource_revisions resource
  WHERE resource.resource_type IN (
    'job', 'position', 'organizational-office', 'office-assignment', 'responsibility',
    'authority-scope', 'responsibility-assignment', 'collective-body',
    'collective-body-membership', 'organizational-authority', 'legal-entity',
    'site', 'workplace', 'employee', 'employment', 'organization-unit'
  ) AND resource.revision = (
    SELECT max(latest.revision) FROM company_resource_revisions latest
    WHERE latest.organization_id = resource.organization_id AND latest.resource_type = resource.resource_type
      AND latest.resource_id = resource.resource_id
      AND (resource.resource_type = 'organization-unit' OR latest.effective_from = resource.effective_from)
  )
), next_versions AS (
  SELECT *, lead(effective_from) OVER (
    PARTITION BY organization_id, resource_type, resource_id ORDER BY effective_from
  ) AS next_from FROM effective_versions
)
SELECT organization_id, resource_type, resource_id, attributes_json,
  CASE WHEN resource_type = 'organization-unit' THEN json_extract(attributes_json, '$.organizationUnitId')
    ELSE resource_id END AS reference_id,
  effective_from AS starts_on,
  CASE WHEN next_from IS NULL OR (effective_to IS NOT NULL AND effective_to < next_from)
    THEN effective_to ELSE next_from END AS ends_on
FROM next_versions WHERE state = 'active';

CREATE VIEW company_governance_resource_references AS
SELECT resource.organization_id, resource.resource_type, resource.resource_id,
  resource.starts_on, resource.ends_on,
  json_extract(reference.value, '$[0]') AS target_type,
  json_extract(reference.value, '$[1]') AS target_id
FROM company_governance_resource_periods resource,
json_each(CASE resource.resource_type
  WHEN 'position' THEN json_array(json_array('job', json_extract(attributes_json, '$.jobId')))
  WHEN 'organizational-office' THEN json_array(
    json_array('position', json_extract(attributes_json, '$.positionId')),
    json_array('organization-unit', json_extract(attributes_json, '$.organizationUnitId')))
  WHEN 'office-assignment' THEN json_array(
    json_array('organizational-office', json_extract(attributes_json, '$.organizationalOfficeId')),
    json_array('employee', json_extract(attributes_json, '$.employeeId')),
    json_array('employment', json_extract(attributes_json, '$.employmentId')))
  WHEN 'authority-scope' THEN CASE
    WHEN json_extract(attributes_json, '$.scopeType') IN ('organization-unit', 'legal-entity', 'site', 'workplace')
    THEN json_array(json_array(json_extract(attributes_json, '$.scopeType'), json_extract(attributes_json, '$.scopeId')))
    ELSE json_array() END
  WHEN 'responsibility-assignment' THEN json_array(
    json_array('responsibility', json_extract(attributes_json, '$.responsibilityId')),
    json_array(json_extract(attributes_json, '$.holderType'), json_extract(attributes_json, '$.holderId')),
    json_array('authority-scope', json_extract(attributes_json, '$.authorityScopeId')))
  WHEN 'collective-body-membership' THEN json_array(
    json_array('collective-body', json_extract(attributes_json, '$.collectiveBodyId')),
    json_array('employee', json_extract(attributes_json, '$.employeeId')))
  WHEN 'organizational-authority' THEN json_array(
    json_array(json_extract(attributes_json, '$.scopeType'), json_extract(attributes_json, '$.scopeId')),
    json_array('employee', json_extract(attributes_json, '$.employeeId')),
    json_array('employment', json_extract(attributes_json, '$.employmentId')))
  ELSE json_array() END) reference
WHERE json_extract(reference.value, '$[1]') IS NOT NULL;

CREATE VIEW company_grade_assignment_coverage AS
WITH prior AS (
  SELECT *, max(coalesce(ends_on, '9999-12-31')) OVER (
    PARTITION BY organization_id, resource_type, resource_id, json_extract(attributes_json, '$.employeeId')
    ORDER BY starts_on, ends_on ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
  ) AS covered_until FROM company_grade_assignment_periods
), islands AS (
  SELECT *, sum(CASE WHEN covered_until IS NULL OR starts_on > covered_until THEN 1 ELSE 0 END) OVER (
    PARTITION BY organization_id, resource_type, resource_id, json_extract(attributes_json, '$.employeeId')
    ORDER BY starts_on, ends_on ROWS UNBOUNDED PRECEDING
  ) AS island FROM prior
)
SELECT organization_id, resource_type, resource_id,
  json_extract(attributes_json, '$.employeeId') AS employee_id, min(starts_on) AS starts_on,
  CASE WHEN max(ends_on IS NULL) = 1 THEN NULL ELSE max(ends_on) END AS ends_on
FROM islands GROUP BY organization_id, resource_type, resource_id, employee_id, island;

CREATE VIEW company_grade_assignment_periods AS
WITH versions AS (
  SELECT resource.* FROM company_resource_revisions resource
  WHERE resource.resource_type IN ('employee', 'employment', 'grade', 'grade-assignment')
    AND resource.revision = (
      SELECT max(latest.revision) FROM company_resource_revisions latest
      WHERE latest.organization_id = resource.organization_id
        AND latest.resource_type = resource.resource_type AND latest.resource_id = resource.resource_id
        AND latest.effective_from = resource.effective_from
    )
), boundaries AS (
  SELECT *, lead(effective_from) OVER (
    PARTITION BY organization_id, resource_type, resource_id ORDER BY effective_from
  ) AS next_from FROM versions
)
SELECT organization_id, resource_type, resource_id, attributes_json,
  effective_from AS starts_on,
  CASE WHEN next_from IS NULL OR (effective_to IS NOT NULL AND effective_to < next_from)
    THEN effective_to ELSE next_from END AS ends_on
FROM boundaries WHERE state = 'active'
  AND (resource_type != 'employment' OR json_extract(attributes_json, '$.status') != 'TERMINATED');

CREATE VIEW company_grade_assignment_violations AS
SELECT assignment.organization_id, assignment.resource_id
FROM company_grade_assignment_periods assignment
WHERE assignment.resource_type = 'grade-assignment' AND (
  NOT EXISTS (
    SELECT 1 FROM company_grade_assignment_coverage employee
    WHERE employee.organization_id = assignment.organization_id AND employee.resource_type = 'employee'
      AND employee.resource_id = json_extract(assignment.attributes_json, '$.employeeId')
      AND employee.starts_on <= assignment.starts_on
      AND (employee.ends_on IS NULL OR (assignment.ends_on IS NOT NULL AND assignment.ends_on <= employee.ends_on))
  ) OR NOT EXISTS (
    SELECT 1 FROM company_grade_assignment_coverage employment
    WHERE employment.organization_id = assignment.organization_id AND employment.resource_type = 'employment'
      AND employment.resource_id = json_extract(assignment.attributes_json, '$.employmentId')
      AND employment.employee_id = json_extract(assignment.attributes_json, '$.employeeId')
      AND employment.starts_on <= assignment.starts_on
      AND (employment.ends_on IS NULL OR (assignment.ends_on IS NOT NULL AND assignment.ends_on <= employment.ends_on))
  ) OR NOT EXISTS (
    SELECT 1 FROM company_grade_assignment_coverage grade
    WHERE grade.organization_id = assignment.organization_id AND grade.resource_type = 'grade'
      AND grade.resource_id = json_extract(assignment.attributes_json, '$.gradeId')
      AND grade.starts_on <= assignment.starts_on
      AND (grade.ends_on IS NULL OR (assignment.ends_on IS NOT NULL AND assignment.ends_on <= grade.ends_on))
  ) OR EXISTS (
    SELECT 1 FROM company_grade_assignment_periods other
    WHERE other.organization_id = assignment.organization_id AND other.resource_type = 'grade-assignment'
      AND other.resource_id != assignment.resource_id
      AND json_extract(other.attributes_json, '$.employmentId') = json_extract(assignment.attributes_json, '$.employmentId')
      AND (other.ends_on IS NULL OR assignment.starts_on < other.ends_on)
      AND (assignment.ends_on IS NULL OR other.starts_on < assignment.ends_on)
  )
);

CREATE VIEW company_organization_assignment_coverage AS
WITH heads AS (
  SELECT employment_id, employee_id, organization_unit_id, starts_on, ends_on FROM company_organization_assignment_period_versions AS period
  WHERE is_void = 0 AND revision = (SELECT max(latest.revision) FROM company_organization_assignment_period_versions AS latest WHERE latest.period_id = period.period_id)
), prior AS (
  SELECT *, max(coalesce(ends_on, '9999-12-31')) OVER (PARTITION BY employment_id, employee_id, organization_unit_id ORDER BY starts_on, ends_on ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) AS covered_until FROM heads
), groups AS (
  SELECT *, sum(CASE WHEN covered_until IS NULL OR starts_on > covered_until THEN 1 ELSE 0 END) OVER (PARTITION BY employment_id, employee_id, organization_unit_id ORDER BY starts_on, ends_on ROWS UNBOUNDED PRECEDING) AS island FROM prior
)
SELECT employment_id, employee_id, organization_unit_id, min(starts_on) AS starts_on, CASE WHEN max(ends_on IS NULL) = 1 THEN NULL ELSE max(ends_on) END AS ends_on
FROM groups GROUP BY employment_id, employee_id, organization_unit_id, island;

CREATE VIEW company_organization_resource_mismatches AS
SELECT binding.organization_unit_id
FROM company_organization_resource_bindings AS binding
JOIN company_organization_unit_period_versions AS period ON period.organization_unit_id = binding.organization_unit_id
WHERE period.revision = (SELECT max(latest.revision) FROM company_organization_unit_period_versions AS latest WHERE latest.period_id = period.period_id)
  AND NOT EXISTS (SELECT 1 FROM company_resource_heads AS head
    WHERE head.organization_id = binding.organization_id AND head.resource_type = 'organization-unit' AND head.resource_id = period.period_id
    AND head.revision = period.revision
    AND head.effective_from IS period.starts_on AND head.effective_to IS period.ends_on
    AND (head.state = 'void') = period.is_void
    AND json_extract(head.attributes_json, '$.organizationUnitId') IS period.organization_unit_id
    AND json_extract(head.attributes_json, '$.code') IS period.code
    AND json_extract(head.attributes_json, '$.officialName') IS period.official_name
    AND json_extract(head.attributes_json, '$.kind') IS period.kind
    AND json_extract(head.attributes_json, '$.parentOrganizationUnitId') IS period.parent_organization_unit_id)
UNION ALL
SELECT binding.organization_unit_id
FROM company_organization_resource_bindings AS binding
JOIN company_resource_heads AS head ON head.organization_id = binding.organization_id AND head.resource_type = 'organization-unit'
  AND json_extract(head.attributes_json, '$.organizationUnitId') = binding.organization_unit_id
WHERE NOT EXISTS (SELECT 1 FROM company_organization_unit_period_versions AS period
  WHERE period.revision = (SELECT max(latest.revision) FROM company_organization_unit_period_versions AS latest WHERE latest.period_id = period.period_id)
    AND head.resource_id = period.period_id
    AND head.revision = period.revision
    AND head.effective_from IS period.starts_on AND head.effective_to IS period.ends_on
    AND (head.state = 'void') = period.is_void
    AND json_extract(head.attributes_json, '$.organizationUnitId') IS period.organization_unit_id
    AND json_extract(head.attributes_json, '$.code') IS period.code
    AND json_extract(head.attributes_json, '$.officialName') IS period.official_name
    AND json_extract(head.attributes_json, '$.kind') IS period.kind
    AND json_extract(head.attributes_json, '$.parentOrganizationUnitId') IS period.parent_organization_unit_id);

CREATE VIEW company_organization_unit_coverage AS
WITH heads AS (
  SELECT organization_unit_id, starts_on, ends_on FROM company_organization_unit_period_versions AS period
  WHERE is_void = 0 AND revision = (SELECT max(latest.revision) FROM company_organization_unit_period_versions AS latest WHERE latest.period_id = period.period_id)
), prior AS (
  SELECT *, max(coalesce(ends_on, '9999-12-31')) OVER (PARTITION BY organization_unit_id ORDER BY starts_on, ends_on ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) AS covered_until FROM heads
), groups AS (
  SELECT *, sum(CASE WHEN covered_until IS NULL OR starts_on > covered_until THEN 1 ELSE 0 END) OVER (PARTITION BY organization_unit_id ORDER BY starts_on, ends_on ROWS UNBOUNDED PRECEDING) AS island FROM prior
)
SELECT organization_unit_id, min(starts_on) AS starts_on, CASE WHEN max(ends_on IS NULL) = 1 THEN NULL ELSE max(ends_on) END AS ends_on
FROM groups GROUP BY organization_unit_id, island;

CREATE VIEW company_personnel_reporting_assignment_coverage AS
WITH heads AS (
  SELECT employment_id, employee_id, organization_unit_id, assignment_type, starts_on, ends_on
  FROM company_organization_assignment_period_versions period
  JOIN company_assignment_period_bindings binding ON binding.period_id = period.period_id
  WHERE is_void = 0 AND revision = (SELECT max(latest.revision)
    FROM company_organization_assignment_period_versions latest WHERE latest.period_id = period.period_id)
), prior AS (
  SELECT *, max(coalesce(ends_on, '9999-12-31')) OVER (
    PARTITION BY employment_id, employee_id, organization_unit_id, assignment_type
    ORDER BY starts_on, ends_on ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) AS covered_until
  FROM heads
), groups AS (
  SELECT *, sum(CASE WHEN covered_until IS NULL OR starts_on > covered_until THEN 1 ELSE 0 END) OVER (
    PARTITION BY employment_id, employee_id, organization_unit_id, assignment_type
    ORDER BY starts_on, ends_on ROWS UNBOUNDED PRECEDING) AS island
  FROM prior
)
SELECT employment_id, employee_id, organization_unit_id, assignment_type, min(starts_on) AS starts_on,
  CASE WHEN max(ends_on IS NULL) = 1 THEN NULL ELSE max(ends_on) END AS ends_on
FROM groups GROUP BY employment_id, employee_id, organization_unit_id, assignment_type, island;

CREATE VIEW company_personnel_reporting_periods AS
WITH effective_versions AS (
  SELECT resource.*, binding.employee_id, binding.employment_id, binding.organization_unit_id, binding.assignment_type
  FROM company_resource_revisions resource
  JOIN company_personnel_reporting_bindings binding
    ON binding.organization_id = resource.organization_id AND resource.resource_type = 'reporting-relation'
      AND binding.resource_id = resource.resource_id
  WHERE resource.revision = (
    SELECT max(latest.revision) FROM company_resource_revisions latest
    WHERE latest.organization_id = resource.organization_id AND latest.resource_type = resource.resource_type
      AND latest.resource_id = resource.resource_id AND latest.effective_from = resource.effective_from
  )
), next_versions AS (
  SELECT *, lead(effective_from) OVER (PARTITION BY organization_id, resource_id ORDER BY effective_from) AS next_from
  FROM effective_versions
)
SELECT organization_id, resource_id, employee_id, employment_id, organization_unit_id, assignment_type,
  effective_from AS starts_on,
  CASE WHEN next_from IS NULL OR (effective_to IS NOT NULL AND effective_to < next_from)
    THEN effective_to ELSE next_from END AS ends_on
FROM next_versions WHERE state = 'active';

CREATE VIEW company_place_reference_period_violations AS
WITH place_references AS (
  SELECT organization_id, resource_type, resource_id, starts_on, ends_on,
    'legal-entity' AS target_type, json_extract(attributes_json, '$.legalEntityId') AS target_id
  FROM company_governance_resource_periods WHERE resource_type = 'site'
  UNION ALL
  SELECT organization_id, resource_type, resource_id, starts_on, ends_on,
    'site', json_extract(attributes_json, '$.siteId')
  FROM company_governance_resource_periods WHERE resource_type = 'workplace'
  UNION ALL
  SELECT organization_id, resource_type, resource_id, starts_on, ends_on,
    'organization-unit', json_extract(attributes_json, '$.organizationUnitId')
  FROM company_governance_resource_periods
  WHERE resource_type = 'workplace' AND json_extract(attributes_json, '$.organizationUnitId') IS NOT NULL
)
SELECT reference.* FROM place_references reference
WHERE NOT EXISTS (
  SELECT 1 FROM company_governance_resource_coverage target
  WHERE target.organization_id = reference.organization_id AND target.resource_type = reference.target_type
    AND target.reference_id = reference.target_id AND target.starts_on <= reference.starts_on
    AND (target.ends_on IS NULL OR (reference.ends_on IS NOT NULL AND reference.ends_on <= target.ends_on))
);

CREATE VIEW company_reporting_employment_violations AS
WITH effective_versions AS (
  SELECT resource.* FROM company_resource_revisions resource
  WHERE resource.resource_type = 'reporting-relation' AND resource.revision = (
    SELECT max(latest.revision) FROM company_resource_revisions latest
    WHERE latest.organization_id = resource.organization_id AND latest.resource_type = resource.resource_type
      AND latest.resource_id = resource.resource_id AND latest.effective_from = resource.effective_from
  )
), next_versions AS (
  SELECT *, lead(effective_from) OVER (PARTITION BY organization_id, resource_id ORDER BY effective_from) AS next_from
  FROM effective_versions
), relations AS (
  SELECT organization_id, resource_id, attributes_json, effective_from AS starts_on,
    CASE WHEN next_from IS NULL OR (effective_to IS NOT NULL AND effective_to < next_from)
      THEN effective_to ELSE next_from END AS ends_on
  FROM next_versions WHERE state = 'active'
), participants AS (
  SELECT organization_id, resource_id, starts_on, ends_on,
    json_extract(attributes_json, '$.employeeId') AS employee_id FROM relations
  UNION ALL
  SELECT organization_id, resource_id, starts_on, ends_on,
    json_extract(attributes_json, '$.managerEmployeeId') AS employee_id FROM relations
), heads AS (
  SELECT binding.organization_id, period.employee_id, period.starts_on, period.ends_on
  FROM company_employment_period_versions period
  JOIN company_workforce_resource_bindings binding
    ON binding.resource_type = 'employee' AND binding.resource_id = period.employee_id
  WHERE period.is_void = 0 AND period.revision = (SELECT max(latest.revision)
    FROM company_employment_period_versions latest WHERE latest.period_id = period.period_id)
), prior AS (
  SELECT *, max(coalesce(ends_on, '9999-12-31')) OVER (
    PARTITION BY organization_id, employee_id ORDER BY starts_on, ends_on
    ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) AS covered_until
  FROM heads
), groups AS (
  SELECT *, sum(CASE WHEN covered_until IS NULL OR starts_on > covered_until THEN 1 ELSE 0 END) OVER (
    PARTITION BY organization_id, employee_id ORDER BY starts_on, ends_on ROWS UNBOUNDED PRECEDING) AS island
  FROM prior
), coverage AS (
  SELECT organization_id, employee_id, min(starts_on) AS starts_on,
    CASE WHEN max(ends_on IS NULL) = 1 THEN NULL ELSE max(ends_on) END AS ends_on
  FROM groups GROUP BY organization_id, employee_id, island
)
SELECT participant.* FROM participants participant WHERE NOT EXISTS (
  SELECT 1 FROM coverage WHERE coverage.organization_id = participant.organization_id
    AND coverage.employee_id = participant.employee_id AND coverage.starts_on <= participant.starts_on
    AND (coverage.ends_on IS NULL OR
      (participant.ends_on IS NOT NULL AND participant.ends_on <= coverage.ends_on))
);

CREATE VIEW company_reporting_reference_period_violations AS
WITH effective_versions AS (
  SELECT resource.* FROM company_resource_revisions resource
  WHERE resource.resource_type = 'reporting-relation' AND resource.revision = (
    SELECT max(latest.revision) FROM company_resource_revisions latest
    WHERE latest.organization_id = resource.organization_id AND latest.resource_type = resource.resource_type
      AND latest.resource_id = resource.resource_id AND latest.effective_from = resource.effective_from
  )
), next_versions AS (
  SELECT *, lead(effective_from) OVER (
    PARTITION BY organization_id, resource_id ORDER BY effective_from
  ) AS next_from FROM effective_versions
), relations AS (
  SELECT organization_id, resource_id, attributes_json, effective_from AS starts_on,
    CASE WHEN next_from IS NULL OR (effective_to IS NOT NULL AND effective_to < next_from)
      THEN effective_to ELSE next_from END AS ends_on
  FROM next_versions WHERE state = 'active'
), reporting_references AS (
  SELECT relation.organization_id, relation.resource_id, relation.starts_on, relation.ends_on,
    json_extract(reference.value, '$[0]') AS target_type,
    json_extract(reference.value, '$[1]') AS target_id
  FROM relations relation, json_each(json_array(
    json_array('employee', json_extract(attributes_json, '$.employeeId')),
    json_array('employee', json_extract(attributes_json, '$.managerEmployeeId')),
    json_array('organization-unit', json_extract(attributes_json, '$.organizationUnitId'))
  )) reference
)
SELECT reference.* FROM reporting_references reference
WHERE NOT EXISTS (
  SELECT 1 FROM company_governance_resource_coverage target
  WHERE target.organization_id = reference.organization_id AND target.resource_type = reference.target_type
    AND target.reference_id = reference.target_id AND target.starts_on <= reference.starts_on
    AND (target.ends_on IS NULL OR (reference.ends_on IS NOT NULL AND reference.ends_on <= target.ends_on))
);

CREATE VIEW company_responsibility_assignment_overlaps AS
WITH effective_versions AS (
  SELECT resource.* FROM company_resource_revisions resource
  WHERE resource.resource_type = 'responsibility-assignment' AND resource.revision = (
    SELECT max(latest.revision) FROM company_resource_revisions latest
    WHERE latest.organization_id = resource.organization_id AND latest.resource_type = resource.resource_type
      AND latest.resource_id = resource.resource_id AND latest.effective_from = resource.effective_from
  )
), next_versions AS (
  SELECT *, lead(effective_from) OVER (PARTITION BY organization_id, resource_id ORDER BY effective_from) AS next_from
  FROM effective_versions
), intervals AS (
  SELECT organization_id, resource_id, effective_from AS starts_on,
    CASE WHEN next_from IS NULL OR (effective_to IS NOT NULL AND effective_to < next_from)
      THEN effective_to ELSE next_from END AS ends_on,
    json_extract(attributes_json, '$.responsibilityId') AS responsibility_id,
    json_extract(attributes_json, '$.holderType') AS holder_type,
    json_extract(attributes_json, '$.holderId') AS holder_id,
    json_extract(attributes_json, '$.authorityScopeId') AS scope_id
  FROM next_versions WHERE state = 'active'
)
SELECT DISTINCT first.organization_id, first.holder_type, first.holder_id
FROM intervals first JOIN intervals second
  ON first.organization_id = second.organization_id AND first.resource_id < second.resource_id
  AND first.responsibility_id = second.responsibility_id AND first.holder_type = second.holder_type
  AND first.holder_id = second.holder_id AND first.scope_id IS second.scope_id
  AND (first.ends_on IS NULL OR second.starts_on < first.ends_on)
  AND (second.ends_on IS NULL OR first.starts_on < second.ends_on);

CREATE VIEW company_responsibility_source_mismatches AS
WITH effective_versions AS (
  SELECT resource.* FROM company_resource_revisions resource
  JOIN company_responsibility_resource_bindings binding
    ON binding.organization_id = resource.organization_id AND binding.resource_id = resource.resource_id
  WHERE resource.resource_type = 'responsibility-assignment' AND resource.revision = (
    SELECT max(latest.revision) FROM company_resource_revisions latest
    WHERE latest.organization_id = resource.organization_id AND latest.resource_type = resource.resource_type
      AND latest.resource_id = resource.resource_id AND latest.effective_from = resource.effective_from
  )
), next_versions AS (
  SELECT *, lead(effective_from) OVER (PARTITION BY organization_id, resource_id ORDER BY effective_from) AS next_from
  FROM effective_versions
), definition_versions AS (
  SELECT resource.* FROM company_resource_revisions resource
  WHERE resource.resource_type IN ('responsibility', 'authority-scope') AND resource.revision = (
    SELECT max(latest.revision) FROM company_resource_revisions latest
    WHERE latest.organization_id = resource.organization_id AND latest.resource_type = resource.resource_type
      AND latest.resource_id = resource.resource_id AND latest.effective_from = resource.effective_from
  )
), definition_intervals AS (
  SELECT *, lead(effective_from) OVER (PARTITION BY organization_id, resource_type, resource_id ORDER BY effective_from) AS next_from
  FROM definition_versions
), intervals AS (
  SELECT organization_id, resource_id, 'public' AS kind, effective_from AS starts_on,
    CASE WHEN next_from IS NULL OR (effective_to IS NOT NULL AND effective_to < next_from)
      THEN effective_to ELSE next_from END AS ends_on
  FROM next_versions WHERE state = 'active'
  UNION ALL
  SELECT source.organization_id, source.resource_id, 'period', period.starts_on, period.ends_on
  FROM company_responsibility_resource_bindings source
  JOIN company_responsibility_period_bindings binding ON binding.resource_id = source.resource_id
  JOIN company_organization_responsibility_period_versions period ON period.period_id = binding.period_id
  WHERE period.is_void = 0 AND period.revision = (
    SELECT max(latest.revision) FROM company_organization_responsibility_period_versions latest WHERE latest.period_id = period.period_id
  )
  UNION ALL
  SELECT source.organization_id, source.resource_id, definition.resource_type, definition.effective_from,
    CASE WHEN definition.next_from IS NULL OR (definition.effective_to IS NOT NULL AND definition.effective_to < definition.next_from)
      THEN definition.effective_to ELSE definition.next_from END
  FROM company_responsibility_resource_bindings source
  JOIN definition_intervals definition ON definition.organization_id = source.organization_id AND (
    (definition.resource_type = 'responsibility' AND definition.resource_id = source.responsibility_id
      AND json_extract(definition.attributes_json, '$.code') = source.responsibility_type)
    OR (definition.resource_type = 'authority-scope' AND definition.resource_id = source.authority_scope_id
      AND json_extract(definition.attributes_json, '$.scopeType') = 'organization-unit'
      AND json_extract(definition.attributes_json, '$.scopeId') = source.organization_unit_id)
  ) WHERE definition.state = 'active'
), prior AS (
  SELECT *, max(coalesce(ends_on, '9999-12-31')) OVER (
    PARTITION BY organization_id, resource_id, kind ORDER BY starts_on, ends_on
    ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
  ) AS covered_until FROM intervals
), islands AS (
  SELECT *, sum(CASE WHEN covered_until IS NULL OR starts_on > covered_until THEN 1 ELSE 0 END) OVER (
    PARTITION BY organization_id, resource_id, kind ORDER BY starts_on, ends_on ROWS UNBOUNDED PRECEDING
  ) AS island FROM prior
), coverage AS (
  SELECT organization_id, resource_id, kind, min(starts_on) AS starts_on,
    CASE WHEN max(ends_on IS NULL) = 1 THEN NULL ELSE max(ends_on) END AS ends_on
  FROM islands GROUP BY organization_id, resource_id, kind, island
)
SELECT source.organization_id, source.resource_id FROM company_responsibility_resource_bindings source
WHERE NOT EXISTS (
  SELECT 1 FROM company_resource_heads head WHERE head.organization_id = source.organization_id
    AND head.resource_type = 'responsibility-assignment' AND head.resource_id = source.resource_id
    AND head.revision = source.resource_revision
) OR NOT EXISTS (
  SELECT 1 FROM company_resource_heads definition WHERE definition.organization_id = source.organization_id
    AND definition.resource_type = 'responsibility' AND definition.resource_id = source.responsibility_id
    AND json_extract(definition.attributes_json, '$.code') = source.responsibility_type
) OR NOT EXISTS (
  SELECT 1 FROM company_resource_heads scope WHERE scope.organization_id = source.organization_id
    AND scope.resource_type = 'authority-scope' AND scope.resource_id = source.authority_scope_id
    AND json_extract(scope.attributes_json, '$.scopeType') = 'organization-unit'
    AND json_extract(scope.attributes_json, '$.scopeId') = source.organization_unit_id
) OR EXISTS (
  SELECT 1 FROM company_resource_revisions resource WHERE resource.organization_id = source.organization_id
    AND resource.resource_type = 'responsibility-assignment' AND resource.resource_id = source.resource_id
    AND (json_extract(resource.attributes_json, '$.holderType') IS NOT 'employee'
      OR json_extract(resource.attributes_json, '$.holderId') IS NOT source.employee_id
      OR json_extract(resource.attributes_json, '$.responsibilityId') IS NOT source.responsibility_id
      OR json_extract(resource.attributes_json, '$.authorityScopeId') IS NOT source.authority_scope_id)
) OR EXISTS (
  SELECT 1 FROM company_responsibility_period_bindings binding
  JOIN company_organization_responsibility_period_versions period ON period.period_id = binding.period_id
  WHERE binding.resource_id = source.resource_id AND period.revision = (
    SELECT max(latest.revision) FROM company_organization_responsibility_period_versions latest WHERE latest.period_id = period.period_id
  ) AND (period.revision != binding.period_revision OR period.employee_id != source.employee_id
    OR period.employment_id != source.employment_id OR period.organization_unit_id != source.organization_unit_id
    OR period.responsibility_type != source.responsibility_type
    OR NOT EXISTS (SELECT 1 FROM company_resource_revisions resource WHERE resource.organization_id = source.organization_id
      AND resource.resource_type = 'responsibility-assignment' AND resource.resource_id = source.resource_id
      AND resource.revision = binding.source_revision))
) OR EXISTS (
  SELECT 1 FROM coverage expected WHERE expected.organization_id = source.organization_id AND expected.resource_id = source.resource_id
    AND expected.kind IN ('public', 'period') AND NOT EXISTS (
      SELECT 1 FROM coverage actual WHERE actual.organization_id = expected.organization_id AND actual.resource_id = expected.resource_id
        AND actual.kind IN ('public', 'period') AND actual.kind != expected.kind AND actual.starts_on <= expected.starts_on
        AND (actual.ends_on IS NULL OR (expected.ends_on IS NOT NULL AND expected.ends_on <= actual.ends_on))
    )
) OR EXISTS (
  SELECT 1 FROM coverage expected WHERE expected.organization_id = source.organization_id AND expected.resource_id = source.resource_id
    AND expected.kind = 'public' AND (
      NOT EXISTS (SELECT 1 FROM coverage definition WHERE definition.organization_id = expected.organization_id
        AND definition.resource_id = expected.resource_id AND definition.kind = 'responsibility'
        AND definition.starts_on <= expected.starts_on
        AND (definition.ends_on IS NULL OR (expected.ends_on IS NOT NULL AND expected.ends_on <= definition.ends_on)))
      OR NOT EXISTS (SELECT 1 FROM coverage scope WHERE scope.organization_id = expected.organization_id
        AND scope.resource_id = expected.resource_id AND scope.kind = 'authority-scope'
        AND scope.starts_on <= expected.starts_on
        AND (scope.ends_on IS NULL OR (expected.ends_on IS NOT NULL AND expected.ends_on <= scope.ends_on)))
    )
);

INSERT INTO "company_organization_change_operations" VALUES ('7d64591a-4423-8a69-b90a-7ff1d89f9303','initialization:organization:default','initialization:organization:default',0,1,1,1,'COMPLETED',0,'0000000000000000000000000000000000000000000000000000000000000000','system:initialization','Initialize organization root','[]');

INSERT INTO "company_organization_lifecycle_states" VALUES (1,1,0);

INSERT INTO "company_organization_unit_period_versions" VALUES ('bb981d2a-0266-456c-8094-ff5b65eb3f14','82072674-7a3e-81a4-b640-635f0026e236',1,'282ccd01-cb30-4d0a-84b4-c675bbbe473c','COMPANY','Company','COMPANY',NULL,'1970-01-01',NULL,0,'7d64591a-4423-8a69-b90a-7ff1d89f9303',0);

INSERT INTO "company_organization_units" VALUES ('282ccd01-cb30-4d0a-84b4-c675bbbe473c','company:root',0);

INSERT INTO "company_organizations" VALUES ('ad4f6cb1-774b-43ae-950f-80e9bc67c66d','organization:default',0,0,0,'','');

INSERT INTO "system_iam_role_permissions" VALUES ('01393b19-cc57-43f7-9b1f-8662ac83f11d','2306ffb6-86e2-4299-bdfb-4dea221557c9','employee_event:manage');

INSERT INTO "system_iam_role_permissions" VALUES ('02ab50e9-98dd-4ef9-8a48-ab2b6000cffd','f7aab585-0f80-4d4f-a578-7300b7f2c73e','governance:read');

INSERT INTO "system_iam_role_permissions" VALUES ('02e2ec78-870b-49c0-9f52-cc2b0343a6d7','2306ffb6-86e2-4299-bdfb-4dea221557c9','employee:lifecycle:request');

INSERT INTO "system_iam_role_permissions" VALUES ('03ce551c-704f-4f5d-bfd5-6f8df34971f9','2306ffb6-86e2-4299-bdfb-4dea221557c9','family_care_leave:manage');

INSERT INTO "system_iam_role_permissions" VALUES ('04e9e3fe-e8a7-4cd7-805f-0ab86c354d65','3c6f8da4-303e-495e-afcf-8837ee0a9403','position:manage');

INSERT INTO "system_iam_role_permissions" VALUES ('0549dfb2-82ae-4fd7-bd0a-d01e9420cdcb','2306ffb6-86e2-4299-bdfb-4dea221557c9','rental:manage');

INSERT INTO "system_iam_role_permissions" VALUES ('060c78fd-69b4-48fd-8eb8-0a19aaa7811c','2306ffb6-86e2-4299-bdfb-4dea221557c9','onboarding:view:all');

INSERT INTO "system_iam_role_permissions" VALUES ('06a737e0-010d-4df4-b247-b2e732a57501','2306ffb6-86e2-4299-bdfb-4dea221557c9','certificate_request:manage');

INSERT INTO "system_iam_role_permissions" VALUES ('06cbb226-8e42-469a-9c80-f40e0186613b','3c6f8da4-303e-495e-afcf-8837ee0a9403','shift_swap:approve');

INSERT INTO "system_iam_role_permissions" VALUES ('07b8438c-ada5-40fe-ac3e-df16f46e63b7','3c6f8da4-303e-495e-afcf-8837ee0a9403','employee_event:read:all');

INSERT INTO "system_iam_role_permissions" VALUES ('08abea98-7ab8-4aec-b7fd-555fa9fc2d2b','077cb75c-8ca8-401a-98e1-320a70a0c947','shift_swap:approve');

INSERT INTO "system_iam_role_permissions" VALUES ('0b0277e2-89b4-42d1-a353-dbecc2efab18','3c6f8da4-303e-495e-afcf-8837ee0a9403','shift_swap:read:all');

INSERT INTO "system_iam_role_permissions" VALUES ('0c89e218-5899-460f-976b-3cbf9fde2a74','3c6f8da4-303e-495e-afcf-8837ee0a9403','grade:read:reports');

INSERT INTO "system_iam_role_permissions" VALUES ('0ce6b894-e0e9-4501-8126-bcb02e7fc172','3c6f8da4-303e-495e-afcf-8837ee0a9403','antisocial_check:manage');

INSERT INTO "system_iam_role_permissions" VALUES ('10ea3d35-dfb6-43e6-b99b-a0a666f422c8','2306ffb6-86e2-4299-bdfb-4dea221557c9','certification:manage');

INSERT INTO "system_iam_role_permissions" VALUES ('1129c32a-73c7-455e-90cb-368df6ec7294','2306ffb6-86e2-4299-bdfb-4dea221557c9','employee:read');

INSERT INTO "system_iam_role_permissions" VALUES ('134c3c08-2fbe-405d-a37b-078a8fa12605','2306ffb6-86e2-4299-bdfb-4dea221557c9','employee:delete');

INSERT INTO "system_iam_role_permissions" VALUES ('1470cd92-efc2-414f-aa1d-d1b6410ee753','3c6f8da4-303e-495e-afcf-8837ee0a9403','headcount_plan:read:all');

INSERT INTO "system_iam_role_permissions" VALUES ('14aa26f1-bef4-45bc-9aca-871e32d5df70','3c6f8da4-303e-495e-afcf-8837ee0a9403','onboarding:view:all');

INSERT INTO "system_iam_role_permissions" VALUES ('1595c140-4011-4b05-a7c9-59a19cfb78b1','077cb75c-8ca8-401a-98e1-320a70a0c947','shift:manage');

INSERT INTO "system_iam_role_permissions" VALUES ('159b13a6-5243-46fc-ab84-faf01dbdbfce','2306ffb6-86e2-4299-bdfb-4dea221557c9','application:read:department');

INSERT INTO "system_iam_role_permissions" VALUES ('18389676-904b-462c-ac7d-5a17fbd83e9c','3c6f8da4-303e-495e-afcf-8837ee0a9403','work_style:read:all');

INSERT INTO "system_iam_role_permissions" VALUES ('18ed9f01-491c-4cc3-a59c-b262777a4b32','3c6f8da4-303e-495e-afcf-8837ee0a9403','onboarding:manage');

INSERT INTO "system_iam_role_permissions" VALUES ('1904b10e-17a8-440f-b7d0-3eef486ba31d','2306ffb6-86e2-4299-bdfb-4dea221557c9','application:read:all');

INSERT INTO "system_iam_role_permissions" VALUES ('19ae78bd-bde8-46f9-abd8-d2ddb1925aba','3c6f8da4-303e-495e-afcf-8837ee0a9403','leave:submit');

INSERT INTO "system_iam_role_permissions" VALUES ('1a401934-9c9b-4848-819c-e70deb4aa211','077cb75c-8ca8-401a-98e1-320a70a0c947','training:manage');

INSERT INTO "system_iam_role_permissions" VALUES ('1a7ee110-0023-44a7-8927-b67d7e75aa55','2306ffb6-86e2-4299-bdfb-4dea221557c9','room:manage');

INSERT INTO "system_iam_role_permissions" VALUES ('1ad88115-d750-49d5-92fe-296033455330','3c6f8da4-303e-495e-afcf-8837ee0a9403','employee:create');

INSERT INTO "system_iam_role_permissions" VALUES ('1bb50d95-d60f-49e7-966c-4fef61ebd81a','2306ffb6-86e2-4299-bdfb-4dea221557c9','goal:read:department');

INSERT INTO "system_iam_role_permissions" VALUES ('1f35d9ce-fe83-466c-be36-d71ac5db0ae3','3c6f8da4-303e-495e-afcf-8837ee0a9403','work_accident:manage');

INSERT INTO "system_iam_role_permissions" VALUES ('207cf6e2-fe6a-4a53-8ace-fa829a3e09aa','3c6f8da4-303e-495e-afcf-8837ee0a9403','leave:approve');

INSERT INTO "system_iam_role_permissions" VALUES ('20946721-52c0-414f-ac75-d063d86bb4b3','077cb75c-8ca8-401a-98e1-320a70a0c947','leave:approve');

INSERT INTO "system_iam_role_permissions" VALUES ('20e7d02d-d971-40a2-a15c-3f64ba10028d','2306ffb6-86e2-4299-bdfb-4dea221557c9','document:manage');

INSERT INTO "system_iam_role_permissions" VALUES ('221514b1-185c-43fc-a362-0596f3525a19','3c6f8da4-303e-495e-afcf-8837ee0a9403','asset:manage');

INSERT INTO "system_iam_role_permissions" VALUES ('22452850-198b-4dee-9d80-c6a523c7c102','2306ffb6-86e2-4299-bdfb-4dea221557c9','health_checkup:manage');

INSERT INTO "system_iam_role_permissions" VALUES ('227feb33-85b1-489e-a86d-2bfc77dd93aa','077cb75c-8ca8-401a-98e1-320a70a0c947','oneonone:create');

INSERT INTO "system_iam_role_permissions" VALUES ('2374435c-6630-44c7-aefe-5d78db4eb766','2306ffb6-86e2-4299-bdfb-4dea221557c9','disciplinary_action:manage');

INSERT INTO "system_iam_role_permissions" VALUES ('2665f0c9-5f5a-4799-a511-b976f9dffc6c','2306ffb6-86e2-4299-bdfb-4dea221557c9','license:read:all');

INSERT INTO "system_iam_role_permissions" VALUES ('26aaf432-c345-4162-9de8-f585d27738dd','2306ffb6-86e2-4299-bdfb-4dea221557c9','governance:read');

INSERT INTO "system_iam_role_permissions" VALUES ('2778d8bd-6764-4f4d-8d23-ead3ce4f8071','077cb75c-8ca8-401a-98e1-320a70a0c947','employee:create');

INSERT INTO "system_iam_role_permissions" VALUES ('2adb6ac6-e9b1-4ea0-a031-3f0e5ba5726e','2306ffb6-86e2-4299-bdfb-4dea221557c9','license:manage');

INSERT INTO "system_iam_role_permissions" VALUES ('2bb533a8-f789-4aef-bbf0-708379fa7eb6','2306ffb6-86e2-4299-bdfb-4dea221557c9','it_incident:read:all');

INSERT INTO "system_iam_role_permissions" VALUES ('2d2627fc-2b74-47e4-bcd6-30e4e9b3cbc3','2306ffb6-86e2-4299-bdfb-4dea221557c9','regulation:manage');

INSERT INTO "system_iam_role_permissions" VALUES ('3176552a-c02e-4d58-87bd-c1d7b27e7be2','2306ffb6-86e2-4299-bdfb-4dea221557c9','grade:read:reports');

INSERT INTO "system_iam_role_permissions" VALUES ('32318b5e-8c51-43eb-9798-d8bff5333341','2306ffb6-86e2-4299-bdfb-4dea221557c9','governance:read:restricted');

INSERT INTO "system_iam_role_permissions" VALUES ('323bc7a2-af89-4736-b0e1-5f43d6090582','2306ffb6-86e2-4299-bdfb-4dea221557c9','certification:read:all');

INSERT INTO "system_iam_role_permissions" VALUES ('32df77e9-1cdc-485c-8a21-85c6acc1856f','3c6f8da4-303e-495e-afcf-8837ee0a9403','salary_revision:manage');

INSERT INTO "system_iam_role_permissions" VALUES ('34b92144-fa8c-44b0-9f74-d4a652d873e2','2306ffb6-86e2-4299-bdfb-4dea221557c9','salary_revision:read:all');

INSERT INTO "system_iam_role_permissions" VALUES ('35d09272-2834-4042-8e3a-6d08dee4487d','2306ffb6-86e2-4299-bdfb-4dea221557c9','antisocial_check:manage');

INSERT INTO "system_iam_role_permissions" VALUES ('370043f4-58d1-4659-a748-0fffb899d712','2306ffb6-86e2-4299-bdfb-4dea221557c9','leave:read:reports');

INSERT INTO "system_iam_role_permissions" VALUES ('3810967e-1990-4e40-8724-8d7e630baae0','2306ffb6-86e2-4299-bdfb-4dea221557c9','disciplinary_action:read:all');

INSERT INTO "system_iam_role_permissions" VALUES ('3839e583-7a66-4267-ae75-d8303c62769b','2306ffb6-86e2-4299-bdfb-4dea221557c9','goal:evaluate');

INSERT INTO "system_iam_role_permissions" VALUES ('3ab51c03-4f6e-47ac-9ecd-8d37b0d39c31','2306ffb6-86e2-4299-bdfb-4dea221557c9','career_posting:manage');

INSERT INTO "system_iam_role_permissions" VALUES ('3b19f4f0-592e-460e-bc9d-c7b48da0c82f','3c6f8da4-303e-495e-afcf-8837ee0a9403','rental:read:all');

INSERT INTO "system_iam_role_permissions" VALUES ('3be46542-b127-4eb4-898a-c89a6d6a1452','2306ffb6-86e2-4299-bdfb-4dea221557c9','decision:manage');

INSERT INTO "system_iam_role_permissions" VALUES ('3c32fc79-dc4d-4d85-aaa6-9bb6de8a3fd2','077cb75c-8ca8-401a-98e1-320a70a0c947','antisocial_check:manage');

INSERT INTO "system_iam_role_permissions" VALUES ('3d4dc812-6ebb-4fcc-8cdb-0ac52fc998c1','3c6f8da4-303e-495e-afcf-8837ee0a9403','year_end_adjustment:manage');

INSERT INTO "system_iam_role_permissions" VALUES ('3e38484b-4b80-4277-b50f-141984106f97','3c6f8da4-303e-495e-afcf-8837ee0a9403','salary_revision:read:all');

INSERT INTO "system_iam_role_permissions" VALUES ('3ecd4103-61fe-46cf-a44d-2a169d1d47ce','3c6f8da4-303e-495e-afcf-8837ee0a9403','leave:read:all');

INSERT INTO "system_iam_role_permissions" VALUES ('3f467c2e-642a-47d8-a3a9-fe5d1165c911','2306ffb6-86e2-4299-bdfb-4dea221557c9','announcement:manage');

INSERT INTO "system_iam_role_permissions" VALUES ('3f943a3e-1c60-497d-a74e-949f717a2a0a','2306ffb6-86e2-4299-bdfb-4dea221557c9','governance:acknowledge');

INSERT INTO "system_iam_role_permissions" VALUES ('4100b401-62ea-4ce9-ade0-558a2846ac22','2306ffb6-86e2-4299-bdfb-4dea221557c9','year_end_adjustment:manage');

INSERT INTO "system_iam_role_permissions" VALUES ('417568d6-18e9-4ac3-a908-4e469594448a','2306ffb6-86e2-4299-bdfb-4dea221557c9','life_event:manage');

INSERT INTO "system_iam_role_permissions" VALUES ('41f8a22b-a694-4309-bb5c-fae32895ead3','2306ffb6-86e2-4299-bdfb-4dea221557c9','partner:manage');

INSERT INTO "system_iam_role_permissions" VALUES ('426d67c1-6e43-4c11-a475-fa3a519900e5','077cb75c-8ca8-401a-98e1-320a70a0c947','survey:manage');

INSERT INTO "system_iam_role_permissions" VALUES ('433ec4fa-7153-4290-8537-55053a7886fb','2306ffb6-86e2-4299-bdfb-4dea221557c9','headcount_plan:manage');

INSERT INTO "system_iam_role_permissions" VALUES ('43cb619b-d386-4bdb-b1e9-2fde5355d283','f7aab585-0f80-4d4f-a578-7300b7f2c73e','governance:acknowledge');

INSERT INTO "system_iam_role_permissions" VALUES ('455e3163-65df-46fc-8e75-61af3aab0879','3c6f8da4-303e-495e-afcf-8837ee0a9403','business_trip:manage');

INSERT INTO "system_iam_role_permissions" VALUES ('468dafca-078b-4ac9-bc88-f57d02bd082a','3c6f8da4-303e-495e-afcf-8837ee0a9403','work_style:manage');

INSERT INTO "system_iam_role_permissions" VALUES ('489057dd-6863-4735-9a38-8a6a6d7c011a','3c6f8da4-303e-495e-afcf-8837ee0a9403','resignation:manage');

INSERT INTO "system_iam_role_permissions" VALUES ('49055c7c-2cde-4f04-ad9d-b2dc8b56a22a','3c6f8da4-303e-495e-afcf-8837ee0a9403','calendar:manage');

INSERT INTO "system_iam_role_permissions" VALUES ('4982f553-cd47-4722-b693-33b7163ffd19','2306ffb6-86e2-4299-bdfb-4dea221557c9','employee:assign_role');

INSERT INTO "system_iam_role_permissions" VALUES ('49d29503-8bd8-4115-b71b-1d1caedecffe','3c6f8da4-303e-495e-afcf-8837ee0a9403','governance:read');

INSERT INTO "system_iam_role_permissions" VALUES ('4b0ed41a-a514-426c-86e3-16bb09ab2f36','2306ffb6-86e2-4299-bdfb-4dea221557c9','contract:read:all');

INSERT INTO "system_iam_role_permissions" VALUES ('4b268af9-5924-41ab-92ed-9a1f4918790e','2306ffb6-86e2-4299-bdfb-4dea221557c9','expense:approve');

INSERT INTO "system_iam_role_permissions" VALUES ('4bff6f56-8ef1-4829-9271-8907d7a258c0','3c6f8da4-303e-495e-afcf-8837ee0a9403','budget:manage');

INSERT INTO "system_iam_role_permissions" VALUES ('4e3bf28a-1dc8-403b-a466-5557ba4496af','3c6f8da4-303e-495e-afcf-8837ee0a9403','employee:update');

INSERT INTO "system_iam_role_permissions" VALUES ('508db400-8eb8-46b3-b324-fec30fbcc289','077cb75c-8ca8-401a-98e1-320a70a0c947','leave:submit');

INSERT INTO "system_iam_role_permissions" VALUES ('514df873-01f5-47e6-b707-94edd4c29ec9','3c6f8da4-303e-495e-afcf-8837ee0a9403','goal:evaluate:reports');

INSERT INTO "system_iam_role_permissions" VALUES ('52b91477-65e0-410c-bdef-6433196dfc5b','2306ffb6-86e2-4299-bdfb-4dea221557c9','asset:manage');

INSERT INTO "system_iam_role_permissions" VALUES ('54bce284-104f-4c34-a0d8-2d7dc0712c7e','3c6f8da4-303e-495e-afcf-8837ee0a9403','family_care_leave:manage');

INSERT INTO "system_iam_role_permissions" VALUES ('55df0007-8c07-4a4a-a94b-20e38d3c8011','3c6f8da4-303e-495e-afcf-8837ee0a9403','disciplinary_action:manage');

INSERT INTO "system_iam_role_permissions" VALUES ('56a7bd6c-6254-4423-bc45-4f5043780649','3c6f8da4-303e-495e-afcf-8837ee0a9403','governance:acknowledge');

INSERT INTO "system_iam_role_permissions" VALUES ('582c05e5-425b-400a-a8f4-07c53ed8f182','3c6f8da4-303e-495e-afcf-8837ee0a9403','goal:read:reports');

INSERT INTO "system_iam_role_permissions" VALUES ('58759ff1-ef7b-4ebb-a603-04bb6afdcc59','2306ffb6-86e2-4299-bdfb-4dea221557c9','application:approve');

INSERT INTO "system_iam_role_permissions" VALUES ('588eb810-a341-43c3-9c03-2f155297fc6a','077cb75c-8ca8-401a-98e1-320a70a0c947','leave:read:reports');

INSERT INTO "system_iam_role_permissions" VALUES ('5979ba42-adcb-470d-8c7e-0b34e17a0e75','2306ffb6-86e2-4299-bdfb-4dea221557c9','leave:read:department');

INSERT INTO "system_iam_role_permissions" VALUES ('59ae0a0f-3ddd-4d78-b8c5-249a2e5b6709','077cb75c-8ca8-401a-98e1-320a70a0c947','asset:manage');

INSERT INTO "system_iam_role_permissions" VALUES ('5ada8967-1843-4f7e-b5e5-34249ca0dbc9','3c6f8da4-303e-495e-afcf-8837ee0a9403','family_care_leave:read:all');

INSERT INTO "system_iam_role_permissions" VALUES ('5b98262f-9768-4250-a8bb-c9cc5365ff27','2306ffb6-86e2-4299-bdfb-4dea221557c9','audit:export');

INSERT INTO "system_iam_role_permissions" VALUES ('5e35b147-3456-46c0-bdbb-34f1a2ee0eb0','2306ffb6-86e2-4299-bdfb-4dea221557c9','shift:manage');

INSERT INTO "system_iam_role_permissions" VALUES ('5eabc31d-cee2-4a8c-bd9f-59459d18baf1','3c6f8da4-303e-495e-afcf-8837ee0a9403','shift:manage');

INSERT INTO "system_iam_role_permissions" VALUES ('63a3630b-6545-4af2-8340-a645bc905a47','077cb75c-8ca8-401a-98e1-320a70a0c947','governance:acknowledge');

INSERT INTO "system_iam_role_permissions" VALUES ('642e80df-1b2f-4454-8a2a-564a0084c343','2306ffb6-86e2-4299-bdfb-4dea221557c9','goal:read:reports');

INSERT INTO "system_iam_role_permissions" VALUES ('6477c837-6688-4c27-82e5-c82e3964cb88','3c6f8da4-303e-495e-afcf-8837ee0a9403','grade:manage');

INSERT INTO "system_iam_role_permissions" VALUES ('647d6554-a5c6-4af8-a839-a1394de18d09','3c6f8da4-303e-495e-afcf-8837ee0a9403','attendance:read:all');

INSERT INTO "system_iam_role_permissions" VALUES ('66973536-f4e8-4d39-8ac5-a7685d40a197','2306ffb6-86e2-4299-bdfb-4dea221557c9','governance:publish');

INSERT INTO "system_iam_role_permissions" VALUES ('66bdc545-ad4e-4c1d-a486-55cf32f3957a','3c6f8da4-303e-495e-afcf-8837ee0a9403','expense:read:all');

INSERT INTO "system_iam_role_permissions" VALUES ('67784fc4-f139-479c-87ba-4d299a7304ea','2306ffb6-86e2-4299-bdfb-4dea221557c9','notification:send');

INSERT INTO "system_iam_role_permissions" VALUES ('678f06ad-49be-499f-bf94-83abdf1fe876','3c6f8da4-303e-495e-afcf-8837ee0a9403','attendance:read:reports');

INSERT INTO "system_iam_role_permissions" VALUES ('68391707-b33f-4358-a2f9-892daa8f25c2','3c6f8da4-303e-495e-afcf-8837ee0a9403','announcement:manage');

INSERT INTO "system_iam_role_permissions" VALUES ('691723c2-8c71-4682-b401-b8b106bc78fe','3c6f8da4-303e-495e-afcf-8837ee0a9403','thanks_redemption:read:all');

INSERT INTO "system_iam_role_permissions" VALUES ('6b49de8b-3f03-4e56-92ea-92c585a8b322','2306ffb6-86e2-4299-bdfb-4dea221557c9','work_style:manage');

INSERT INTO "system_iam_role_permissions" VALUES ('6d510edb-1b82-4e1a-9bda-be6eeef7309d','3c6f8da4-303e-495e-afcf-8837ee0a9403','commendation:manage');

INSERT INTO "system_iam_role_permissions" VALUES ('6d8f1923-2cd4-452f-a42a-ca00402da6c1','3c6f8da4-303e-495e-afcf-8837ee0a9403','life_event:manage');

INSERT INTO "system_iam_role_permissions" VALUES ('6f46fab7-8f99-46ce-a451-3507e8ebe091','2306ffb6-86e2-4299-bdfb-4dea221557c9','recruitment:manage');

INSERT INTO "system_iam_role_permissions" VALUES ('707f6201-7ad5-4bbb-863f-4d5c1daa96d9','3c6f8da4-303e-495e-afcf-8837ee0a9403','leave:read:reports');

INSERT INTO "system_iam_role_permissions" VALUES ('71f02c51-1466-4c10-9cca-edc63066035c','3c6f8da4-303e-495e-afcf-8837ee0a9403','batch:view');

INSERT INTO "system_iam_role_permissions" VALUES ('71fdacc2-eedc-441c-aca0-fa224ee67e2c','2306ffb6-86e2-4299-bdfb-4dea221557c9','audit:read');

INSERT INTO "system_iam_role_permissions" VALUES ('72cfbb87-1867-4325-a249-ec92e3a4b517','3c6f8da4-303e-495e-afcf-8837ee0a9403','life_event:read:all');

INSERT INTO "system_iam_role_permissions" VALUES ('792e430a-584a-4aea-9167-1d4f6609e1b2','3c6f8da4-303e-495e-afcf-8837ee0a9403','employee:lifecycle:request');

INSERT INTO "system_iam_role_permissions" VALUES ('7a3c56f3-ba8b-4f33-9651-5a89b6f8d8ac','2306ffb6-86e2-4299-bdfb-4dea221557c9','dashboard:view');

INSERT INTO "system_iam_role_permissions" VALUES ('7dba526a-86bf-464b-8a60-7bfd63c81632','077cb75c-8ca8-401a-98e1-320a70a0c947','attendance:read:reports');

INSERT INTO "system_iam_role_permissions" VALUES ('7e5da58e-85d9-4333-b872-2a5ef447be54','3c6f8da4-303e-495e-afcf-8837ee0a9403','grade:read:all');

INSERT INTO "system_iam_role_permissions" VALUES ('7e6f739b-d9eb-45ae-abf2-3f6d0a7200fb','2306ffb6-86e2-4299-bdfb-4dea221557c9','budget:read:all');

INSERT INTO "system_iam_role_permissions" VALUES ('7fb4ae5f-a042-492f-8af4-78a3b2c2a357','2306ffb6-86e2-4299-bdfb-4dea221557c9','work_accident:manage');

INSERT INTO "system_iam_role_permissions" VALUES ('7ffebcfd-bed8-42d3-847c-1c3bacb58a09','2306ffb6-86e2-4299-bdfb-4dea221557c9','expense:read:all');

INSERT INTO "system_iam_role_permissions" VALUES ('80806916-2329-492b-97af-f7eed2da7ab0','2306ffb6-86e2-4299-bdfb-4dea221557c9','document:read:all');

INSERT INTO "system_iam_role_permissions" VALUES ('81a49d5e-f54c-4ead-934c-e44472cf990a','3c6f8da4-303e-495e-afcf-8837ee0a9403','dashboard:view');

INSERT INTO "system_iam_role_permissions" VALUES ('8311eaae-16de-43ce-ba75-e721cc80420f','2306ffb6-86e2-4299-bdfb-4dea221557c9','it_incident:manage');

INSERT INTO "system_iam_role_permissions" VALUES ('835988ed-7fbf-47b3-826b-1baee0a447c7','2306ffb6-86e2-4299-bdfb-4dea221557c9','contract:manage');

INSERT INTO "system_iam_role_permissions" VALUES ('8636619a-51a6-497b-b239-392181e4cbf4','3c6f8da4-303e-495e-afcf-8837ee0a9403','application:approve');

INSERT INTO "system_iam_role_permissions" VALUES ('87e5845e-5256-47d4-9964-2b443f84213a','3c6f8da4-303e-495e-afcf-8837ee0a9403','work_accident:read:all');

INSERT INTO "system_iam_role_permissions" VALUES ('8acc6b59-7661-41e2-ae53-a4283116c064','3c6f8da4-303e-495e-afcf-8837ee0a9403','business_trip:read:all');

INSERT INTO "system_iam_role_permissions" VALUES ('8b7fb3e4-a6a6-4d9b-acb3-a86239332001','2306ffb6-86e2-4299-bdfb-4dea221557c9','calendar:manage');

INSERT INTO "system_iam_role_permissions" VALUES ('8c1ff7fb-02d2-4133-a85a-647c8a1c39b8','2306ffb6-86e2-4299-bdfb-4dea221557c9','thanks_reward:manage');

INSERT INTO "system_iam_role_permissions" VALUES ('8ca548a3-a2e7-439e-807b-ddd2a79d60d8','2306ffb6-86e2-4299-bdfb-4dea221557c9','leave:approve');

INSERT INTO "system_iam_role_permissions" VALUES ('8cf6a7b0-674c-44ed-9ea5-60223faa6277','3c6f8da4-303e-495e-afcf-8837ee0a9403','employee:read');

INSERT INTO "system_iam_role_permissions" VALUES ('8d78cf83-4ff7-423f-804f-5f89aa924172','2306ffb6-86e2-4299-bdfb-4dea221557c9','governance:manage');

INSERT INTO "system_iam_role_permissions" VALUES ('8d9c07fe-3ce1-43da-b20f-495a441b29b3','3c6f8da4-303e-495e-afcf-8837ee0a9403','recruitment:manage');

INSERT INTO "system_iam_role_permissions" VALUES ('8e65e077-cf9a-4336-93c9-bf00befad7c8','077cb75c-8ca8-401a-98e1-320a70a0c947','employee:lifecycle:request');

INSERT INTO "system_iam_role_permissions" VALUES ('9187d8b0-b52b-44f5-8ead-f43b3591ccbd','2306ffb6-86e2-4299-bdfb-4dea221557c9','business_trip:read:all');

INSERT INTO "system_iam_role_permissions" VALUES ('91895c10-19a1-47c3-9dec-7445d7bdfa57','077cb75c-8ca8-401a-98e1-320a70a0c947','notification:send');

INSERT INTO "system_iam_role_permissions" VALUES ('918d1dd8-e1c5-4ae4-a7fe-b99c9b1ca332','2306ffb6-86e2-4299-bdfb-4dea221557c9','grade:read:all');

INSERT INTO "system_iam_role_permissions" VALUES ('91fde920-31c3-4522-8ad1-d2b37113f0a6','2306ffb6-86e2-4299-bdfb-4dea221557c9','management_dashboard:view');

INSERT INTO "system_iam_role_permissions" VALUES ('935c414b-cd79-44df-94ad-173ce5fb5cf1','3c6f8da4-303e-495e-afcf-8837ee0a9403','goal:evaluate');

INSERT INTO "system_iam_role_permissions" VALUES ('93a2c270-e056-43a8-ad80-8775c88c4229','2306ffb6-86e2-4299-bdfb-4dea221557c9','governance:review');

INSERT INTO "system_iam_role_permissions" VALUES ('93ea3262-653f-4f0d-bf78-92e88d85696a','3c6f8da4-303e-495e-afcf-8837ee0a9403','regulation:manage');

INSERT INTO "system_iam_role_permissions" VALUES ('98204434-1ce9-4ee2-98ac-89647ce9e0c5','077cb75c-8ca8-401a-98e1-320a70a0c947','expense:approve');

INSERT INTO "system_iam_role_permissions" VALUES ('9892564f-ad6e-4300-80a5-5dacf0aefeb3','2306ffb6-86e2-4299-bdfb-4dea221557c9','health_checkup:read:all');

INSERT INTO "system_iam_role_permissions" VALUES ('98a2ced0-57fa-479b-a765-9bc80dbd59fe','077cb75c-8ca8-401a-98e1-320a70a0c947','career_posting:manage');

INSERT INTO "system_iam_role_permissions" VALUES ('9955e431-b76e-4bd9-8e90-8046b05a1664','3c6f8da4-303e-495e-afcf-8837ee0a9403','year_end_adjustment:read:all');

INSERT INTO "system_iam_role_permissions" VALUES ('9d082a6c-3f80-4223-8519-2ccf449f7bf4','3c6f8da4-303e-495e-afcf-8837ee0a9403','career_posting:manage');

INSERT INTO "system_iam_role_permissions" VALUES ('9ee73943-e1c3-4e17-9224-81dd61ecaa03','f7aab585-0f80-4d4f-a578-7300b7f2c73e','leave:submit');

INSERT INTO "system_iam_role_permissions" VALUES ('a07a4c59-5e4c-4664-b772-d18b1a970c1b','2306ffb6-86e2-4299-bdfb-4dea221557c9','goal:read:all');

INSERT INTO "system_iam_role_permissions" VALUES ('a09df564-77fa-4eb5-a85f-07f2d77a0ca6','077cb75c-8ca8-401a-98e1-320a70a0c947','governance:review');

INSERT INTO "system_iam_role_permissions" VALUES ('a0eee7cb-1f19-40f2-9767-62275d4036b0','2306ffb6-86e2-4299-bdfb-4dea221557c9','family_care_leave:read:all');

INSERT INTO "system_iam_role_permissions" VALUES ('a15f050f-77c5-48d8-9582-a90c03291ff0','077cb75c-8ca8-401a-98e1-320a70a0c947','onboarding:manage');

INSERT INTO "system_iam_role_permissions" VALUES ('a23834d0-d25e-4099-b13e-6e04caff3aa4','3c6f8da4-303e-495e-afcf-8837ee0a9403','health_checkup:manage');

INSERT INTO "system_iam_role_permissions" VALUES ('a5a1c855-5fe3-4be6-97aa-340b6493de9a','2306ffb6-86e2-4299-bdfb-4dea221557c9','employee:create');

INSERT INTO "system_iam_role_permissions" VALUES ('a5d6baaf-e652-4178-92f7-14c6913bc973','3c6f8da4-303e-495e-afcf-8837ee0a9403','certification:read:all');

INSERT INTO "system_iam_role_permissions" VALUES ('a787fe02-08de-4801-85ba-09adf533ccc3','2306ffb6-86e2-4299-bdfb-4dea221557c9','year_end_adjustment:read:all');

INSERT INTO "system_iam_role_permissions" VALUES ('a89f18ea-7cb6-41fc-b9bb-8bd699c8eaad','3c6f8da4-303e-495e-afcf-8837ee0a9403','thanks_reward:manage');

INSERT INTO "system_iam_role_permissions" VALUES ('a9787d7c-c615-4693-9e5a-7f51b49daa24','3c6f8da4-303e-495e-afcf-8837ee0a9403','evaluation:administer');

INSERT INTO "system_iam_role_permissions" VALUES ('a9a3d46e-51f9-45d0-9c7b-496d2a641314','2306ffb6-86e2-4299-bdfb-4dea221557c9','work_accident:read:all');

INSERT INTO "system_iam_role_permissions" VALUES ('ac47b82f-6d70-4eda-b161-3620c3e19aef','2306ffb6-86e2-4299-bdfb-4dea221557c9','employee:archive');

INSERT INTO "system_iam_role_permissions" VALUES ('ac4e2b84-5e6d-4e82-9dc0-fba766f2796d','3c6f8da4-303e-495e-afcf-8837ee0a9403','application:read:all');

INSERT INTO "system_iam_role_permissions" VALUES ('aef9bf4b-e273-4839-a50e-7e6fde3a07ec','2306ffb6-86e2-4299-bdfb-4dea221557c9','leave:read:all');

INSERT INTO "system_iam_role_permissions" VALUES ('af9b1e06-f9f0-4426-a9a4-d474dcc1766d','3c6f8da4-303e-495e-afcf-8837ee0a9403','employee:lifecycle:apply');

INSERT INTO "system_iam_role_permissions" VALUES ('b01c0489-50b6-43c8-aa81-e3c8088cf25f','3c6f8da4-303e-495e-afcf-8837ee0a9403','certificate_request:read:all');

INSERT INTO "system_iam_role_permissions" VALUES ('b039d089-856a-4bbc-a4c6-61c0b1f148e5','3c6f8da4-303e-495e-afcf-8837ee0a9403','training:manage');

INSERT INTO "system_iam_role_permissions" VALUES ('b0a67240-1cec-4ab5-bd3d-e792d6905be1','2306ffb6-86e2-4299-bdfb-4dea221557c9','commendation:manage');

INSERT INTO "system_iam_role_permissions" VALUES ('b2b1aaca-20db-4530-a9fd-9156d3834cc7','2306ffb6-86e2-4299-bdfb-4dea221557c9','grade:manage');

INSERT INTO "system_iam_role_permissions" VALUES ('b605424b-1664-4bf2-ab94-9c66f9247709','3c6f8da4-303e-495e-afcf-8837ee0a9403','rental:manage');

INSERT INTO "system_iam_role_permissions" VALUES ('b6b45024-a507-4612-9763-74305d5fc9f7','2306ffb6-86e2-4299-bdfb-4dea221557c9','attendance:read:reports');

INSERT INTO "system_iam_role_permissions" VALUES ('b6f7f362-1800-4e09-9b4b-d74721e43f11','2306ffb6-86e2-4299-bdfb-4dea221557c9','thanks_redemption:read:all');

INSERT INTO "system_iam_role_permissions" VALUES ('b74e7196-16aa-4543-958b-fa4b234abcf6','2306ffb6-86e2-4299-bdfb-4dea221557c9','system:admin');

INSERT INTO "system_iam_role_permissions" VALUES ('ba48adca-90d3-4b9a-b8f6-51482b39484b','2306ffb6-86e2-4299-bdfb-4dea221557c9','review:administer');

INSERT INTO "system_iam_role_permissions" VALUES ('ba8c295b-2c69-4157-add2-c3b996177606','077cb75c-8ca8-401a-98e1-320a70a0c947','governance:read');

INSERT INTO "system_iam_role_permissions" VALUES ('bb9f4320-09a6-4c2b-8c9b-c55f2233627d','3c6f8da4-303e-495e-afcf-8837ee0a9403','application_template:manage');

INSERT INTO "system_iam_role_permissions" VALUES ('bc115501-dcd5-4d61-8072-a2fece7e6db8','2306ffb6-86e2-4299-bdfb-4dea221557c9','meeting:manage');

INSERT INTO "system_iam_role_permissions" VALUES ('bcc3b4b6-9864-41c0-a368-55b091ca6604','3c6f8da4-303e-495e-afcf-8837ee0a9403','review:administer');

INSERT INTO "system_iam_role_permissions" VALUES ('bd78de62-7f9f-437c-ac67-b50546bf6557','3c6f8da4-303e-495e-afcf-8837ee0a9403','expense:approve');

INSERT INTO "system_iam_role_permissions" VALUES ('bdcc1cd8-28da-4e26-a79b-fea7d54f6f6d','3c6f8da4-303e-495e-afcf-8837ee0a9403','certificate_request:manage');

INSERT INTO "system_iam_role_permissions" VALUES ('be1f8abb-07e9-444d-959f-c6be31e4fed0','2306ffb6-86e2-4299-bdfb-4dea221557c9','headcount_plan:read:all');

INSERT INTO "system_iam_role_permissions" VALUES ('be4f79cd-bb2d-45a3-81bc-16af20a47f50','3c6f8da4-303e-495e-afcf-8837ee0a9403','certification:manage');

INSERT INTO "system_iam_role_permissions" VALUES ('c039ed6d-d72c-463d-8b1b-5e82f224c57f','2306ffb6-86e2-4299-bdfb-4dea221557c9','employee_event:read:all');

INSERT INTO "system_iam_role_permissions" VALUES ('c0eef22b-b766-49ad-bfc8-7e854388572b','3c6f8da4-303e-495e-afcf-8837ee0a9403','employee:delete');

INSERT INTO "system_iam_role_permissions" VALUES ('c1185490-92e3-4f84-a62d-60597c24cd57','2306ffb6-86e2-4299-bdfb-4dea221557c9','salary_revision:manage');

INSERT INTO "system_iam_role_permissions" VALUES ('c20e66fd-69f1-4140-8a9b-73008b36c08c','3c6f8da4-303e-495e-afcf-8837ee0a9403','thanks_redemption:approve');

INSERT INTO "system_iam_role_permissions" VALUES ('c337ae9e-50b5-4ed3-9ac7-fbdfa6bab9d8','2306ffb6-86e2-4299-bdfb-4dea221557c9','employee:lifecycle:apply');

INSERT INTO "system_iam_role_permissions" VALUES ('c3666d36-56d0-4cfa-929c-b84809925f88','3c6f8da4-303e-495e-afcf-8837ee0a9403','employee_event:manage');

INSERT INTO "system_iam_role_permissions" VALUES ('c4377c02-10f1-4a00-beca-6be34049fd14','2306ffb6-86e2-4299-bdfb-4dea221557c9','evaluation:administer');

INSERT INTO "system_iam_role_permissions" VALUES ('c624d46c-ed01-4336-841f-7d69164dfbfb','077cb75c-8ca8-401a-98e1-320a70a0c947','goal:evaluate:reports');

INSERT INTO "system_iam_role_permissions" VALUES ('c6582a36-4224-41cb-9205-b2cfa8320329','3c6f8da4-303e-495e-afcf-8837ee0a9403','employee:lifecycle:read:all');

INSERT INTO "system_iam_role_permissions" VALUES ('c66cba84-bd72-4305-b819-1980b4e28a2a','3c6f8da4-303e-495e-afcf-8837ee0a9403','room:manage');

INSERT INTO "system_iam_role_permissions" VALUES ('c6e366ed-5376-4470-8c55-24184df8f296','3c6f8da4-303e-495e-afcf-8837ee0a9403','employee:archive');

INSERT INTO "system_iam_role_permissions" VALUES ('c96e001f-7f30-4b7e-a658-570255830662','3c6f8da4-303e-495e-afcf-8837ee0a9403','governance:review');

INSERT INTO "system_iam_role_permissions" VALUES ('c9b56890-a283-432a-940d-4284458cc290','2306ffb6-86e2-4299-bdfb-4dea221557c9','resignation:manage');

INSERT INTO "system_iam_role_permissions" VALUES ('c9f2d9a4-39f7-4ccb-bad8-2871c1f143c7','2306ffb6-86e2-4299-bdfb-4dea221557c9','rental:read:all');

INSERT INTO "system_iam_role_permissions" VALUES ('cc10d025-fefd-48b1-a176-d55255d9e1e6','3c6f8da4-303e-495e-afcf-8837ee0a9403','disciplinary_action:read:all');

INSERT INTO "system_iam_role_permissions" VALUES ('cd2bfc4e-59be-4eb3-910f-a9877452ab7e','3c6f8da4-303e-495e-afcf-8837ee0a9403','survey:manage');

INSERT INTO "system_iam_role_permissions" VALUES ('cd49a483-14a7-4bbd-b4ba-6ee0903512ae','2306ffb6-86e2-4299-bdfb-4dea221557c9','application_template:manage');

INSERT INTO "system_iam_role_permissions" VALUES ('cff5898b-67aa-4ba9-a735-cdf502fd1a19','2306ffb6-86e2-4299-bdfb-4dea221557c9','life_event:read:all');

INSERT INTO "system_iam_role_permissions" VALUES ('d05fb3ae-efb9-408c-82f2-1eefce55fe2a','2306ffb6-86e2-4299-bdfb-4dea221557c9','business_trip:manage');

INSERT INTO "system_iam_role_permissions" VALUES ('d1141ae3-5b4e-427c-9622-48ed16fbed23','2306ffb6-86e2-4299-bdfb-4dea221557c9','work_style:read:all');

INSERT INTO "system_iam_role_permissions" VALUES ('d16c1e69-b2d6-43bf-8870-a59e26c3d046','3c6f8da4-303e-495e-afcf-8837ee0a9403','org:manage');

INSERT INTO "system_iam_role_permissions" VALUES ('d2043420-fd3f-4304-9d3e-a8964fab9131','2306ffb6-86e2-4299-bdfb-4dea221557c9','employee:lifecycle:read:all');

INSERT INTO "system_iam_role_permissions" VALUES ('d367a8f3-b319-4a00-b5fd-b235f0c79fe1','077cb75c-8ca8-401a-98e1-320a70a0c947','application:approve');

INSERT INTO "system_iam_role_permissions" VALUES ('d3929fc1-cdfc-472d-84a7-250d0915af6d','2306ffb6-86e2-4299-bdfb-4dea221557c9','leave:submit');

INSERT INTO "system_iam_role_permissions" VALUES ('d3ef52ad-b52e-40e3-98af-dfb9eece7bbf','3c6f8da4-303e-495e-afcf-8837ee0a9403','goal:read:all');

INSERT INTO "system_iam_role_permissions" VALUES ('d6cd3fa9-cf3f-49a1-b9b5-d5ee4eba6e6e','077cb75c-8ca8-401a-98e1-320a70a0c947','grade:read:reports');

INSERT INTO "system_iam_role_permissions" VALUES ('d942c272-d8a6-4f79-beda-e2e896bae31d','2306ffb6-86e2-4299-bdfb-4dea221557c9','thanks_redemption:approve');

INSERT INTO "system_iam_role_permissions" VALUES ('da0341be-3dc8-47d0-8a64-dcb118250ce8','2306ffb6-86e2-4299-bdfb-4dea221557c9','ringi:read:all');

INSERT INTO "system_iam_role_permissions" VALUES ('da070459-55ff-4274-a0a0-dab4be13feac','077cb75c-8ca8-401a-98e1-320a70a0c947','batch:view');

INSERT INTO "system_iam_role_permissions" VALUES ('dedae82c-e6ce-4e94-abc7-9a5cbf6b47b7','2306ffb6-86e2-4299-bdfb-4dea221557c9','onboarding:manage');

INSERT INTO "system_iam_role_permissions" VALUES ('e04626ba-3fda-42d4-aa7f-8c7adad95ac1','3c6f8da4-303e-495e-afcf-8837ee0a9403','management_dashboard:view');

INSERT INTO "system_iam_role_permissions" VALUES ('e3951a80-fd20-4bc7-83a3-cfb3da3be678','2306ffb6-86e2-4299-bdfb-4dea221557c9','oneonone:read:department');

INSERT INTO "system_iam_role_permissions" VALUES ('e412c870-9d36-4933-8d44-49fcdbcfe87d','2306ffb6-86e2-4299-bdfb-4dea221557c9','batch:view');

INSERT INTO "system_iam_role_permissions" VALUES ('e41641fe-4c21-4a20-ae5d-716c853bb92c','2306ffb6-86e2-4299-bdfb-4dea221557c9','training:manage');

INSERT INTO "system_iam_role_permissions" VALUES ('e4ef9400-a818-4a80-a7ee-3d1b12149820','2306ffb6-86e2-4299-bdfb-4dea221557c9','org:manage');

INSERT INTO "system_iam_role_permissions" VALUES ('e70e9711-f8ca-4b4c-8f3d-859c4bedc50f','2306ffb6-86e2-4299-bdfb-4dea221557c9','shift_swap:approve');

INSERT INTO "system_iam_role_permissions" VALUES ('e7717ef2-6486-4c0d-a41a-94afa5ddfc6d','2306ffb6-86e2-4299-bdfb-4dea221557c9','goal:evaluate:reports');

INSERT INTO "system_iam_role_permissions" VALUES ('e784c9c3-bdf0-4ac8-a97f-800af0bd3ae9','2306ffb6-86e2-4299-bdfb-4dea221557c9','oneonone:create');

INSERT INTO "system_iam_role_permissions" VALUES ('e79da4f9-0246-4013-8b05-5c3b6c3b116a','3c6f8da4-303e-495e-afcf-8837ee0a9403','headcount_plan:manage');

INSERT INTO "system_iam_role_permissions" VALUES ('ea40f5f8-950f-486e-a862-d0fce3a550e2','077cb75c-8ca8-401a-98e1-320a70a0c947','employee:read');

INSERT INTO "system_iam_role_permissions" VALUES ('ea5e9f16-a6b2-4a0e-aea1-1df495fc8f89','077cb75c-8ca8-401a-98e1-320a70a0c947','room:manage');

INSERT INTO "system_iam_role_permissions" VALUES ('ede9e66b-97db-42c3-b197-7b9c7f380326','077cb75c-8ca8-401a-98e1-320a70a0c947','goal:read:reports');

INSERT INTO "system_iam_role_permissions" VALUES ('ee9ee6af-ff12-42e4-aa96-b44083ee63e0','077cb75c-8ca8-401a-98e1-320a70a0c947','onboarding:view:all');

INSERT INTO "system_iam_role_permissions" VALUES ('eedc4cd8-74bc-4e8d-ade5-85b2dd59f3e9','2306ffb6-86e2-4299-bdfb-4dea221557c9','employee:update');

INSERT INTO "system_iam_role_permissions" VALUES ('ef4da810-53bf-43f9-9c20-f807e5a6cb81','077cb75c-8ca8-401a-98e1-320a70a0c947','dashboard:view');

INSERT INTO "system_iam_role_permissions" VALUES ('efcfe743-1ccd-4067-ad97-f8311fd0ddd8','3c6f8da4-303e-495e-afcf-8837ee0a9403','health_checkup:read:all');

INSERT INTO "system_iam_role_permissions" VALUES ('f0115eb3-0b4f-4ccc-a1fd-1df2096738a4','2306ffb6-86e2-4299-bdfb-4dea221557c9','account:manage');

INSERT INTO "system_iam_role_permissions" VALUES ('f1c3883d-e90d-4670-bec2-b4d2be89247c','2306ffb6-86e2-4299-bdfb-4dea221557c9','budget:manage');

INSERT INTO "system_iam_role_permissions" VALUES ('f22d7c0f-0e6f-4cb0-bf60-562ede644fe3','077cb75c-8ca8-401a-98e1-320a70a0c947','employee:update');

INSERT INTO "system_iam_role_permissions" VALUES ('f3192527-1293-49bd-8b57-a0ea6946ac64','2306ffb6-86e2-4299-bdfb-4dea221557c9','shift_swap:read:all');

INSERT INTO "system_iam_role_permissions" VALUES ('f5e1a97e-76a6-41c4-acb3-64d925676c85','2306ffb6-86e2-4299-bdfb-4dea221557c9','resignation:read:all');

INSERT INTO "system_iam_role_permissions" VALUES ('f6c1ca2c-b637-4ae1-9acd-b034bbdc3497','2306ffb6-86e2-4299-bdfb-4dea221557c9','attendance:read:department');

INSERT INTO "system_iam_role_permissions" VALUES ('f6f6bd28-f7c8-43e1-89cd-bb54e1178dc2','3c6f8da4-303e-495e-afcf-8837ee0a9403','notification:send');

INSERT INTO "system_iam_role_permissions" VALUES ('f8a3bb8c-6488-45b5-b1f8-42c711fc21f2','2306ffb6-86e2-4299-bdfb-4dea221557c9','export:run');

INSERT INTO "system_iam_role_permissions" VALUES ('f9392cb8-3fee-42ba-a234-8f69f8eaa677','2306ffb6-86e2-4299-bdfb-4dea221557c9','attendance:read:all');

INSERT INTO "system_iam_role_permissions" VALUES ('f9703b85-2713-4bf2-a752-5dbe4f15be36','2306ffb6-86e2-4299-bdfb-4dea221557c9','iam:write');

INSERT INTO "system_iam_role_permissions" VALUES ('f9acd7ef-3790-49aa-8917-2fdfc11e6eae','3c6f8da4-303e-495e-afcf-8837ee0a9403','oneonone:create');

INSERT INTO "system_iam_role_permissions" VALUES ('fa193255-ecc9-431c-a084-a0671552c7ca','2306ffb6-86e2-4299-bdfb-4dea221557c9','iam:read');

INSERT INTO "system_iam_role_permissions" VALUES ('fc2b57f4-6ace-4409-b0ed-c36e090d34ee','3c6f8da4-303e-495e-afcf-8837ee0a9403','resignation:read:all');

INSERT INTO "system_iam_role_permissions" VALUES ('fc430cbc-975f-4dbf-9524-75ee0290ac84','2306ffb6-86e2-4299-bdfb-4dea221557c9','survey:manage');

INSERT INTO "system_iam_role_permissions" VALUES ('fe821fc8-1b33-4c15-86a4-8752d52240fd','2306ffb6-86e2-4299-bdfb-4dea221557c9','position:manage');

INSERT INTO "system_iam_role_permissions" VALUES ('fe96f897-1614-421a-baad-30c7b4da2b8f','2306ffb6-86e2-4299-bdfb-4dea221557c9','certificate_request:read:all');

INSERT INTO "system_iam_roles" VALUES ('f7aab585-0f80-4d4f-a578-7300b7f2c73e','1','company:member','managed','標準利用者','自己操作を行う標準の権限セット。組織上の役割とは独立する',0,0,NULL);

INSERT INTO "system_iam_roles" VALUES ('077cb75c-8ca8-401a-98e1-320a70a0c947','2','company:manager','managed','業務管理者','管理業務の操作権限セット。対象範囲は組織関係で別に判定する',0,0,NULL);

INSERT INTO "system_iam_roles" VALUES ('3c6f8da4-303e-495e-afcf-8837ee0a9403','3','company:hr','managed','人事管理者','全社の人事業務を扱う権限セット',0,0,NULL);

INSERT INTO "system_iam_roles" VALUES ('2306ffb6-86e2-4299-bdfb-4dea221557c9','4','company:root','managed','システム管理者','IAM とアカウント管理を含むシステム管理権限セット',0,0,NULL);

CREATE TRIGGER company_account_employee_links_delete_guard
BEFORE DELETE ON company_account_employee_links
BEGIN
  SELECT RAISE(ABORT, 'account employee links are append only');
END;

CREATE TRIGGER company_account_employee_links_immutable
BEFORE UPDATE ON company_account_employee_links
BEGIN
  SELECT RAISE(ABORT, 'account employee links are immutable');
END;

CREATE TRIGGER company_account_employee_resource_bindings_delete_guard
BEFORE DELETE ON company_account_employee_resource_bindings
BEGIN
  SELECT RAISE(ABORT, 'company account link bindings are immutable');
END;

CREATE TRIGGER company_account_employee_resource_bindings_update_guard
BEFORE UPDATE ON company_account_employee_resource_bindings
BEGIN
  SELECT RAISE(ABORT, 'company account link bindings are immutable');
END;

CREATE TRIGGER company_account_employee_resource_commit_guard
AFTER UPDATE OF revision ON company_organizations
BEGIN
  SELECT RAISE(ABORT, 'company account link employee is not connected') WHERE EXISTS (
    SELECT 1 FROM company_resource_heads resource
    WHERE resource.organization_id = NEW.id AND resource.resource_type = 'account-employee-link'
      AND NOT EXISTS (SELECT 1 FROM company_workforce_resource_bindings employee
        WHERE employee.organization_id = resource.organization_id AND employee.resource_type = 'employee'
          AND employee.resource_id = json_extract(resource.attributes_json, '$.employeeId'))
  );
  INSERT INTO company_account_employee_links (account_id, employee_id)
  SELECT json_extract(resource.attributes_json, '$.accountId'), json_extract(resource.attributes_json, '$.employeeId')
  FROM company_resource_heads resource WHERE resource.organization_id = NEW.id
    AND resource.resource_type = 'account-employee-link'
    AND NOT EXISTS (SELECT 1 FROM company_account_employee_links original
      WHERE original.account_id = json_extract(resource.attributes_json, '$.accountId'));
  INSERT INTO company_account_employee_resource_bindings
    (resource_id, organization_id, account_id, employee_id, recorded_at)
  SELECT resource_id, organization_id, json_extract(attributes_json, '$.accountId'),
    json_extract(attributes_json, '$.employeeId'), updated_at
  FROM company_resource_heads resource WHERE resource.organization_id = NEW.id
    AND resource.resource_type = 'account-employee-link'
    AND NOT EXISTS (SELECT 1 FROM company_account_employee_resource_bindings binding WHERE binding.resource_id = resource.resource_id);
  SELECT RAISE(ABORT, 'company account link period is not covered') WHERE EXISTS (
    SELECT 1 FROM company_account_employee_link_period_violations
  );
END;

CREATE TRIGGER company_account_employee_resource_owner_guard
BEFORE INSERT ON company_resource_revisions WHEN NEW.resource_type = 'account-employee-link'
BEGIN
  SELECT RAISE(ABORT, 'company account link owner is immutable') WHERE
    NEW.organization_id != 'ad4f6cb1-774b-43ae-950f-80e9bc67c66d'
    OR EXISTS (SELECT 1 FROM company_resource_heads previous
      WHERE previous.organization_id = NEW.organization_id AND previous.resource_type = NEW.resource_type
        AND (previous.resource_id = NEW.resource_id AND (
          json_extract(previous.attributes_json, '$.accountId') IS NOT json_extract(NEW.attributes_json, '$.accountId')
          OR json_extract(previous.attributes_json, '$.employeeId') IS NOT json_extract(NEW.attributes_json, '$.employeeId'))
        OR previous.resource_id != NEW.resource_id AND (
          json_extract(previous.attributes_json, '$.accountId') = json_extract(NEW.attributes_json, '$.accountId')
          OR json_extract(previous.attributes_json, '$.employeeId') = json_extract(NEW.attributes_json, '$.employeeId'))))
    OR EXISTS (SELECT 1 FROM company_account_employee_links original WHERE
      original.account_id = json_extract(NEW.attributes_json, '$.accountId') AND original.employee_id IS NOT json_extract(NEW.attributes_json, '$.employeeId')
      OR original.employee_id = json_extract(NEW.attributes_json, '$.employeeId') AND original.account_id IS NOT json_extract(NEW.attributes_json, '$.accountId'));
  SELECT RAISE(ABORT, 'company account link account is missing') WHERE NOT EXISTS (
    SELECT 1 FROM system_accounts WHERE id = json_extract(NEW.attributes_json, '$.accountId')
  );
END;

CREATE TRIGGER company_account_profiles_identity_update
BEFORE UPDATE OF id ON company_account_profiles
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

CREATE TRIGGER company_assignment_adoption_insert_guard
BEFORE INSERT ON company_assignment_resource_adoptions
BEGIN
  SELECT RAISE(ABORT, 'assignment adoption evidence is incomplete')
  WHERE json_type(NEW.mappings_json) IS NOT 'array'
    OR (SELECT count(*) FROM json_each(NEW.mappings_json)) !=
      (SELECT count(DISTINCT json_extract(mapping.value, '$.periodId')) FROM json_each(NEW.mappings_json) mapping)
    OR EXISTS (
      SELECT 1 FROM json_each(NEW.mappings_json) mapping
      WHERE json_type(mapping.value, '$.periodId') IS NOT 'text'
        OR json_type(mapping.value, '$.existingResourceId') IS NOT 'text'
        OR NOT EXISTS (
          SELECT 1 FROM company_organization_assignment_period_versions period
          WHERE period.period_id = json_extract(mapping.value, '$.periodId')
            AND period.recorded_by_action_id = (SELECT key_operation.id FROM company_organization_change_operations key_operation WHERE key_operation.operation_key = 'assignment-adoption:' || NEW.snapshot_digest)
        )
    )
    OR NEW.organization_revision != (SELECT revision FROM company_organizations WHERE id = 'ad4f6cb1-774b-43ae-950f-80e9bc67c66d')
    OR NOT EXISTS (
      SELECT 1 FROM company_organization_change_operations operation
      WHERE operation.id = (SELECT key_operation.id FROM company_organization_change_operations key_operation WHERE key_operation.operation_key = 'assignment-adoption:' || NEW.snapshot_digest)
        AND operation.status = 'PENDING'
        AND operation.change_count = NEW.adopted_periods
        AND operation.applied_count = NEW.adopted_periods
        AND operation.actor_account_id = NEW.actor_account_id AND operation.reason = NEW.reason
    )
    OR NEW.adopted_periods != (SELECT count(*) FROM company_organization_assignment_period_versions period
      WHERE period.recorded_by_action_id = (SELECT key_operation.id FROM company_organization_change_operations key_operation WHERE key_operation.operation_key = 'assignment-adoption:' || NEW.snapshot_digest))
    OR EXISTS (
      SELECT 1 FROM company_organization_assignment_period_versions period
      WHERE period.recorded_by_action_id = (SELECT key_operation.id FROM company_organization_change_operations key_operation WHERE key_operation.operation_key = 'assignment-adoption:' || NEW.snapshot_digest)
        AND (period.employee_id != NEW.employee_id OR NOT EXISTS (
          SELECT 1 FROM company_assignment_period_bindings binding
          JOIN company_assignment_resource_bindings source ON source.resource_id = binding.resource_id
          JOIN company_resource_revisions applied ON applied.organization_id = source.organization_id
            AND applied.resource_type = 'assignment' AND applied.resource_id = source.resource_id
            AND applied.revision = source.resource_revision
          WHERE binding.period_id = period.period_id AND binding.period_revision = period.revision
            AND binding.source_revision = source.resource_revision AND source.employee_id = NEW.employee_id
            AND applied.organization_revision > NEW.expected_revision
            AND applied.organization_revision <= NEW.organization_revision
            AND applied.actor_account_id = NEW.actor_account_id AND applied.reason = NEW.reason
            AND (
              (source.resource_revision = 1 AND NOT EXISTS (
                SELECT 1 FROM json_each(NEW.mappings_json) mapping
                WHERE json_extract(mapping.value, '$.periodId') = period.period_id
              ))
              OR (source.resource_revision > 1 AND EXISTS (
                SELECT 1 FROM json_each(NEW.mappings_json) mapping
                WHERE json_extract(mapping.value, '$.periodId') = period.period_id
                  AND json_extract(mapping.value, '$.existingResourceId') = source.resource_id
                  AND source.resource_revision = 1 + (
                    SELECT max(json_extract(confirmed.value, '$.revision'))
                    FROM json_each(NEW.source_json, '$.publicAssignments') confirmed
                    WHERE json_extract(confirmed.value, '$.resourceId') = source.resource_id
                      AND json_type(confirmed.value, '$.bindingEmployeeId') = 'null'
                  )
              ))
            )
        ))
    );
END;

CREATE TRIGGER company_assignment_employment_projection_guard
BEFORE UPDATE OF revision ON company_organizations
WHEN NEW.revision != OLD.revision
BEGIN
  SELECT RAISE(ABORT, 'organization assignment employment period is not covered')
  WHERE EXISTS (
    SELECT 1 FROM company_organization_assignment_period_versions assignment
    JOIN company_assignment_period_bindings period_binding ON period_binding.period_id = assignment.period_id
    JOIN company_assignment_resource_bindings resource_binding ON resource_binding.resource_id = period_binding.resource_id
    WHERE resource_binding.organization_id = NEW.id AND assignment.is_void = 0
      AND assignment.revision = (
        SELECT max(latest.revision) FROM company_organization_assignment_period_versions latest
        WHERE latest.period_id = assignment.period_id
      )
      AND NOT EXISTS (
        SELECT 1 FROM company_employment_period_versions employment
        WHERE employment.period_id = assignment.employment_id
          AND employment.employee_id = assignment.employee_id AND employment.is_void = 0
          AND employment.revision = (
            SELECT max(latest.revision) FROM company_employment_period_versions latest
            WHERE latest.period_id = employment.period_id
          )
          AND employment.starts_on <= assignment.starts_on
          AND (employment.ends_on IS NULL OR
            (assignment.ends_on IS NOT NULL AND assignment.ends_on <= employment.ends_on))
      )
  );
END;

CREATE TRIGGER company_assignment_period_bindings_delete_guard
BEFORE DELETE ON company_assignment_period_bindings
BEGIN
  SELECT RAISE(ABORT, 'organization assignment period source is immutable');
END;

CREATE TRIGGER company_assignment_period_bindings_update_guard
BEFORE UPDATE ON company_assignment_period_bindings
WHEN NEW.period_id != OLD.period_id OR NEW.resource_id != OLD.resource_id OR NEW.period_revision < OLD.period_revision
BEGIN
  SELECT RAISE(ABORT, 'organization assignment period source is immutable');
END;

CREATE TRIGGER company_assignment_resource_adoptions_delete_guard
BEFORE DELETE ON company_assignment_resource_adoptions
BEGIN
  SELECT RAISE(ABORT, 'assignment adoption evidence is immutable');
END;

CREATE TRIGGER company_assignment_resource_adoptions_identity_update
BEFORE UPDATE OF id ON company_assignment_resource_adoptions
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

CREATE TRIGGER company_assignment_resource_adoptions_update_guard
BEFORE UPDATE ON company_assignment_resource_adoptions
BEGIN
  SELECT RAISE(ABORT, 'assignment adoption evidence is immutable');
END;

CREATE TRIGGER company_assignment_resource_bindings_delete_guard
BEFORE DELETE ON company_assignment_resource_bindings
BEGIN
  SELECT RAISE(ABORT, 'organization assignment source identity is immutable');
END;

CREATE TRIGGER company_assignment_resource_bindings_update_guard
BEFORE UPDATE ON company_assignment_resource_bindings
WHEN NEW.resource_id != OLD.resource_id OR NEW.organization_id != OLD.organization_id
  OR NEW.employee_id != OLD.employee_id OR NEW.resource_revision < OLD.resource_revision
BEGIN
  SELECT RAISE(ABORT, 'organization assignment source identity is immutable');
END;

CREATE TRIGGER company_audit_append_guard_prevent_delete
BEFORE DELETE ON company_audit_append_guard
BEGIN
  SELECT RAISE(ABORT, 'company audit append guard is immutable');
END;

CREATE TRIGGER company_audit_append_guard_prevent_insert
BEFORE INSERT ON company_audit_append_guard
WHEN
  NOT EXISTS (
    SELECT 1 FROM company_audit_events
    WHERE id = NEW.audit_id AND event_id = NEW.event_id
  )
  OR EXISTS (
    SELECT 1 FROM company_audit_append_guard
    WHERE audit_id = NEW.audit_id OR event_id = NEW.event_id
  )
BEGIN
  SELECT RAISE(ABORT, 'company audit append guard is immutable');
END;

CREATE TRIGGER company_audit_append_guard_prevent_update
BEFORE UPDATE ON company_audit_append_guard
BEGIN
  SELECT RAISE(ABORT, 'company audit append guard is immutable');
END;

CREATE TRIGGER company_audit_event_appends_dispatch
AFTER INSERT ON company_audit_event_appends
BEGIN
  INSERT INTO company_audit_events (
    event_id, request_id, actor_account_id, action, target_type, target_id, outcome,
    reason_code, authorization_json, before_json, after_json, metadata_json,
    client_ip, client_name, created_at
  ) VALUES (
    NEW.event_id, NEW.request_id, NEW.actor_account_id, NEW.action, NEW.target_type,
    NEW.target_id, NEW.outcome, NEW.reason_code, NEW.authorization_json, NEW.before_json,
    NEW.after_json, NEW.metadata_json, NEW.client_ip, NEW.client_name, NEW.created_at
  );

  INSERT INTO company_audit_event_employee_contexts (audit_event_id, employee_id)
  SELECT event.id, NEW.actor_employee_id
  FROM company_audit_events event
  WHERE event.event_id = NEW.event_id
    AND NEW.actor_employee_id IS NOT NULL;

  DELETE FROM company_audit_event_appends WHERE staging_id = NEW.staging_id;
END;

CREATE TRIGGER company_audit_event_employee_contexts_prevent_delete
BEFORE DELETE ON company_audit_event_employee_contexts
BEGIN
  SELECT RAISE(ABORT, 'company audit employee context is append only');
END;

CREATE TRIGGER company_audit_event_employee_contexts_prevent_update
BEFORE UPDATE ON company_audit_event_employee_contexts
BEGIN
  SELECT RAISE(ABORT, 'company audit employee context is append only');
END;

CREATE TRIGGER company_audit_event_employee_contexts_validate_insert
BEFORE INSERT ON company_audit_event_employee_contexts
WHEN NOT EXISTS (
  SELECT 1 FROM company_audit_events WHERE id = NEW.audit_event_id
)
BEGIN
  SELECT RAISE(ABORT, 'company audit employee context requires an audit event');
END;

CREATE TRIGGER company_audit_events_prevent_delete
BEFORE DELETE ON company_audit_events
BEGIN
  SELECT RAISE(ABORT, 'company audit events are append only');
END;

CREATE TRIGGER company_audit_events_prevent_update
BEFORE UPDATE ON company_audit_events
BEGIN
  SELECT RAISE(ABORT, 'company audit events are append only');
END;

CREATE TRIGGER company_audit_events_register_insert
AFTER INSERT ON company_audit_events
BEGIN
  SELECT RAISE(ABORT, 'company audit events are append only')
  WHERE EXISTS (
    SELECT 1 FROM company_audit_append_guard
    WHERE audit_id = NEW.id OR event_id = NEW.event_id
  );

  INSERT INTO company_audit_append_guard (audit_id, event_id)
  VALUES (NEW.id, NEW.event_id);
END;

CREATE TRIGGER company_authority_scope_reference_guard
BEFORE INSERT ON company_resource_revisions
WHEN NEW.resource_type = 'authority-scope'
  AND NEW.state = 'active'
  AND json_extract(NEW.attributes_json, '$.scopeType') IN (
    'organization-unit', 'legal-entity', 'site', 'workplace'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM company_resource_revisions AS scoped
    WHERE scoped.organization_id = NEW.organization_id
      AND scoped.resource_type = json_extract(NEW.attributes_json, '$.scopeType')
      AND (CASE WHEN scoped.resource_type = 'organization-unit' THEN json_extract(scoped.attributes_json, '$.organizationUnitId') ELSE scoped.resource_id END) = json_extract(NEW.attributes_json, '$.scopeId')
      AND scoped.state = 'active'
  )
BEGIN
  SELECT RAISE(ABORT, 'company_governance_organization_reference_invalid');
END;

CREATE TRIGGER company_bootstrap_receipts_identity_update
BEFORE UPDATE OF id ON company_bootstrap_receipts
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

CREATE TRIGGER company_bootstrap_receipts_immutable_delete
BEFORE DELETE ON company_bootstrap_receipts
BEGIN
  SELECT RAISE(ABORT, 'company bootstrap receipt immutable');
END;

CREATE TRIGGER company_bootstrap_receipts_immutable_update
BEFORE UPDATE ON company_bootstrap_receipts
BEGIN
  SELECT RAISE(ABORT, 'company bootstrap receipt immutable');
END;

CREATE TRIGGER company_calendar_days_identity_update
BEFORE UPDATE OF id, legacy_id ON company_calendar_days
WHEN NEW.id IS NOT OLD.id OR NEW.legacy_id IS NOT OLD.legacy_id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

CREATE TRIGGER company_calendar_days_legacy_id_insert
BEFORE INSERT ON company_calendar_days
WHEN NEW.legacy_id IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'record_legacy_id_immutable'); END;

CREATE TRIGGER company_calendar_days_source_freeze_delete
BEFORE DELETE ON company_calendar_days
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'company-calendar' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'company_calendar_record_source_frozen'); END;

CREATE TRIGGER company_calendar_days_source_freeze_insert
BEFORE INSERT ON company_calendar_days
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'company-calendar' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'company_calendar_record_source_frozen'); END;

CREATE TRIGGER company_calendar_days_source_freeze_update
BEFORE UPDATE ON company_calendar_days
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'company-calendar' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'company_calendar_record_source_frozen'); END;

CREATE TRIGGER company_collective_body_membership_reference_guard
BEFORE INSERT ON company_resource_revisions
WHEN NEW.resource_type = 'collective-body-membership'
  AND NEW.state = 'active'
  AND (
    NOT EXISTS (
      SELECT 1 FROM company_resource_revisions AS body
      WHERE body.organization_id = NEW.organization_id
        AND body.resource_type = 'collective-body'
        AND body.resource_id = json_extract(NEW.attributes_json, '$.collectiveBodyId')
        AND body.state = 'active'
    )
    OR NOT EXISTS (
      SELECT 1 FROM company_resource_revisions AS employee
      WHERE employee.organization_id = NEW.organization_id
        AND employee.resource_type = 'employee'
        AND employee.resource_id = json_extract(NEW.attributes_json, '$.employeeId')
        AND employee.state = 'active'
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'company_collective_body_membership_reference_not_found');
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

CREATE TRIGGER company_command_receipts_identity_update
BEFORE UPDATE OF id ON company_command_receipts
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

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

CREATE TRIGGER company_definition_adoptions_delete_guard
BEFORE DELETE ON company_definition_resource_adoptions
BEGIN
  SELECT RAISE(ABORT, 'company_definition_adoption_immutable');
END;

CREATE TRIGGER company_definition_adoptions_insert_guard
BEFORE INSERT ON company_definition_resource_adoptions
BEGIN
  SELECT RAISE(ABORT, 'company_definition_adoption_resource_invalid')
  WHERE NOT EXISTS (
    SELECT 1 FROM company_resource_revisions resource
    JOIN company_command_receipts receipt
      ON receipt.organization_id = resource.organization_id AND receipt.command_id = resource.command_id
    WHERE resource.organization_id = NEW.organization_id AND resource.resource_type = NEW.resource_type
      AND resource.resource_id = NEW.resource_id AND resource.revision = 1
      AND resource.command_id = NEW.command_id AND resource.organization_revision = NEW.organization_revision
      AND resource.effective_from = NEW.observed_on AND resource.effective_to IS NULL AND resource.state = 'active'
      AND resource.actor_account_id = NEW.actor_account_id AND resource.recorded_at = NEW.recorded_at
      AND resource.reason = NEW.reason AND receipt.expected_revision = NEW.expected_revision
      AND json_extract(resource.attributes_json, '$.code') = json_extract(NEW.source_json, '$.definition.code')
      AND json_extract(resource.attributes_json, '$.officialName') = json_extract(NEW.source_json, '$.definition.name')
      AND json_extract(resource.attributes_json, '$.rank') = json_extract(NEW.source_json, '$.definition.rank')
      AND json_extract(resource.attributes_json, '$.description') IS json_extract(NEW.source_json, '$.definition.description')
  );
END;

CREATE TRIGGER company_definition_adoptions_update_guard
BEFORE UPDATE ON company_definition_resource_adoptions
BEGIN
  SELECT RAISE(ABORT, 'company_definition_adoption_immutable');
END;

CREATE TRIGGER company_definition_resource_adoptions_identity_update
BEFORE UPDATE OF id ON company_definition_resource_adoptions
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

CREATE TRIGGER company_employee_resource_adoptions_identity_update
BEFORE UPDATE OF id ON company_employee_resource_adoptions
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

CREATE TRIGGER company_employee_resource_adoptions_no_delete
BEFORE DELETE ON company_employee_resource_adoptions
BEGIN
  SELECT RAISE(ABORT, 'employee resource adoption is immutable');
END;

CREATE TRIGGER company_employee_resource_adoptions_no_update
BEFORE UPDATE ON company_employee_resource_adoptions
BEGIN
  SELECT RAISE(ABORT, 'employee resource adoption is immutable');
END;

CREATE TRIGGER company_employee_status_period_versions_identity_update
BEFORE UPDATE OF id ON company_employee_status_period_versions
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

CREATE TRIGGER company_employee_status_period_versions_no_delete
BEFORE DELETE ON company_employee_status_period_versions
BEGIN
  SELECT RAISE(ABORT, 'company employee status period versions are append only');
END;

CREATE TRIGGER company_employee_status_period_versions_no_update
BEFORE UPDATE ON company_employee_status_period_versions
BEGIN
  SELECT RAISE(ABORT, 'company employee status period versions are append only');
END;

CREATE TRIGGER company_employees_identity_update
BEFORE UPDATE OF id, legacy_id ON company_employees
WHEN NEW.id IS NOT OLD.id OR NEW.legacy_id IS NOT OLD.legacy_id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

CREATE TRIGGER company_employees_legacy_id_insert
BEFORE INSERT ON company_employees
WHEN NEW.legacy_id IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'record_legacy_id_immutable'); END;

CREATE TRIGGER company_employment_authority_commit_guard
AFTER UPDATE OF revision ON company_organizations
WHEN NOT EXISTS (
  SELECT 1 FROM company_workforce_resource_bindings binding
  JOIN company_employee_lifecycle_revisions lifecycle ON lifecycle.employee_id = binding.employee_id
  WHERE binding.organization_id = NEW.id AND binding.resource_type = 'employee'
    AND binding.lifecycle_revision != lifecycle.revision
)
BEGIN
  SELECT RAISE(ABORT, 'company_employment_authority_period_not_covered')
  WHERE EXISTS (SELECT 1 FROM company_employment_authority_violations WHERE organization_id = NEW.id);
END;

CREATE TRIGGER company_employment_authority_organization_guard
AFTER UPDATE OF status ON company_organization_change_operations
WHEN NEW.status = 'COMPLETED' AND NOT EXISTS (
  SELECT 1 FROM company_resource_revisions resource
  JOIN company_organizations organization ON organization.id = resource.organization_id
  WHERE resource.organization_revision > organization.revision
)
BEGIN
  SELECT RAISE(ABORT, 'company_employment_authority_period_not_covered')
  WHERE EXISTS (SELECT 1 FROM company_employment_authority_violations);
END;

CREATE TRIGGER company_employment_authority_projection_guard
AFTER UPDATE OF lifecycle_revision ON company_workforce_resource_bindings
WHEN NEW.resource_type = 'employee' AND NEW.lifecycle_revision = (
  SELECT revision FROM company_employee_lifecycle_revisions WHERE employee_id = NEW.employee_id
) AND NOT EXISTS (
  SELECT 1 FROM company_resource_revisions resource
  JOIN company_organizations organization ON organization.id = resource.organization_id
  WHERE resource.organization_id = NEW.organization_id AND resource.organization_revision > organization.revision
)
BEGIN
  SELECT RAISE(ABORT, 'company_employment_authority_period_not_covered')
  WHERE EXISTS (SELECT 1 FROM company_employment_authority_violations
    WHERE organization_id = NEW.organization_id AND employee_id = NEW.employee_id);
END;

CREATE TRIGGER company_employment_contract_term_insert_guard
AFTER INSERT ON company_resource_revisions
WHEN NEW.resource_type = 'employment'
BEGIN
  SELECT RAISE(ABORT, 'company_employment_contract_term_invalid')
  WHERE EXISTS (
    SELECT 1 FROM company_employment_contract_term_violations
    WHERE organization_id = NEW.organization_id AND resource_id = NEW.resource_id AND revision = NEW.revision
  );
END;

CREATE TRIGGER company_employment_employer_commit_guard
BEFORE UPDATE OF revision ON company_organizations
BEGIN
  SELECT RAISE(ABORT, 'company_employment_employer_reference_invalid')
  WHERE EXISTS (
    SELECT 1 FROM company_employment_employer_reference_violations WHERE organization_id = NEW.id
  );
END;

CREATE TRIGGER company_employment_period_versions_identity_update
BEFORE UPDATE OF id ON company_employment_period_versions
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

CREATE TRIGGER company_employment_period_versions_no_delete
BEFORE DELETE ON company_employment_period_versions
BEGIN
  SELECT RAISE(ABORT, 'company employment period versions are append only');
END;

CREATE TRIGGER company_employment_period_versions_no_update
BEFORE UPDATE ON company_employment_period_versions
BEGIN
  SELECT RAISE(ABORT, 'company employment period versions are append only');
END;

CREATE TRIGGER company_employments_employee_immutable
BEFORE UPDATE OF employee_id ON company_employments
WHEN NEW.employee_id IS NOT OLD.employee_id
BEGIN
  SELECT RAISE(ABORT, 'employment employee identity is immutable');
END;

CREATE TRIGGER company_employments_identity_update
BEFORE UPDATE OF id, legacy_id ON company_employments
WHEN NEW.id IS NOT OLD.id OR NEW.legacy_id IS NOT OLD.legacy_id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

CREATE TRIGGER company_employments_legacy_id_insert
BEFORE INSERT ON company_employments
WHEN NEW.legacy_id IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'record_legacy_id_immutable'); END;

CREATE TRIGGER company_employments_organization_period_guard
BEFORE UPDATE OF hire_date, termination_date ON company_employments
BEGIN
  SELECT RAISE(ABORT, 'employment change would orphan an organization assignment')
  WHERE EXISTS (
    SELECT 1 FROM company_organization_assignment_period_versions assignment
    WHERE assignment.employment_id = NEW.id
      AND assignment.is_void = 0
      AND assignment.revision = (
        SELECT max(latest.revision)
        FROM company_organization_assignment_period_versions latest
        WHERE latest.period_id = assignment.period_id
      )
      AND (
        NEW.hire_date > assignment.starts_on
        OR (
          NEW.termination_date IS NOT NULL
          AND (
            assignment.ends_on IS NULL
            OR assignment.ends_on > date(NEW.termination_date, '+1 day')
          )
        )
      )
  );

  SELECT RAISE(ABORT, 'employment change would orphan an organization responsibility')
  WHERE EXISTS (
    SELECT 1 FROM company_organization_responsibility_period_versions responsibility
    WHERE responsibility.employment_id = NEW.id
      AND responsibility.is_void = 0
      AND responsibility.revision = (
        SELECT max(latest.revision)
        FROM company_organization_responsibility_period_versions latest
        WHERE latest.period_id = responsibility.period_id
      )
      AND (
        NEW.hire_date > responsibility.starts_on
        OR (
          NEW.termination_date IS NOT NULL
          AND (
            responsibility.ends_on IS NULL
            OR responsibility.ends_on > date(NEW.termination_date, '+1 day')
          )
        )
      )
  );

  SELECT RAISE(ABORT, 'employment change would leave an assigned employee without manager')
  WHERE NEW.termination_date IS NOT NULL AND EXISTS (
    SELECT 1 FROM company_organization_assignment_period_versions assignment
    WHERE assignment.manager_employee_id = NEW.employee_id
      AND assignment.is_void = 0
      AND assignment.revision = (
        SELECT max(latest.revision)
        FROM company_organization_assignment_period_versions latest
        WHERE latest.period_id = assignment.period_id
      )
      AND (
        assignment.ends_on IS NULL
        OR assignment.ends_on > date(NEW.termination_date, '+1 day')
      )
  );
END;

CREATE TRIGGER company_external_identity_imports_identity_update
BEFORE UPDATE OF id ON company_external_identity_imports
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

CREATE TRIGGER company_external_identity_imports_no_delete
BEFORE DELETE ON company_external_identity_imports
BEGIN
  SELECT RAISE(ABORT, 'external identity import is immutable');
END;

CREATE TRIGGER company_external_identity_imports_no_update
BEFORE UPDATE ON company_external_identity_imports
BEGIN
  SELECT RAISE(ABORT, 'external identity import is immutable');
END;

CREATE TRIGGER company_external_identity_sources_no_delete
BEFORE DELETE ON company_external_identity_sources
BEGIN
  SELECT RAISE(ABORT, 'external identity source is immutable');
END;

CREATE TRIGGER company_external_identity_sources_revision
BEFORE UPDATE ON company_external_identity_sources
WHEN NEW.identity_id IS NOT OLD.identity_id
  OR NEW.organization_id IS NOT OLD.organization_id
  OR NEW.source_revision <= OLD.source_revision
  OR NEW.updated_at < OLD.updated_at
BEGIN
  SELECT RAISE(ABORT, 'external identity source revision conflict');
END;

CREATE TRIGGER company_governance_organization_revision_guard
BEFORE UPDATE OF revision ON company_organizations
WHEN EXISTS (
  SELECT 1 FROM company_governance_organization_reference_violations violation
  WHERE violation.organization_id = NEW.id
)
BEGIN
  SELECT RAISE(ABORT, 'company_governance_organization_reference_invalid');
END;

CREATE TRIGGER company_governance_reference_period_commit_guard
BEFORE UPDATE OF revision ON company_organizations
BEGIN
  SELECT RAISE(ABORT, 'company_governance_reference_period_not_covered')
  WHERE EXISTS (SELECT 1 FROM company_governance_reference_period_violations WHERE organization_id = NEW.id);
END;

CREATE TRIGGER company_grade_assignment_commit_guard
BEFORE UPDATE OF revision ON company_organizations
WHEN NEW.revision != OLD.revision
BEGIN
  SELECT RAISE(ABORT, 'company_grade_assignment_invalid') WHERE EXISTS (
    SELECT 1 FROM company_grade_assignment_violations WHERE organization_id = NEW.id
  );
END;

CREATE TRIGGER company_grade_assignment_owner_guard
BEFORE INSERT ON company_resource_revisions
WHEN NEW.resource_type = 'grade-assignment'
BEGIN
  SELECT RAISE(ABORT, 'company_grade_assignment_owner_changed') WHERE EXISTS (
    SELECT 1 FROM company_resource_revisions original
    WHERE original.organization_id = NEW.organization_id AND original.resource_type = NEW.resource_type
      AND original.resource_id = NEW.resource_id AND original.revision = 1
      AND (json_extract(original.attributes_json, '$.employeeId') IS NOT json_extract(NEW.attributes_json, '$.employeeId')
        OR json_extract(original.attributes_json, '$.employmentId') IS NOT json_extract(NEW.attributes_json, '$.employmentId'))
  );
END;

CREATE TRIGGER company_grade_award_archive_no_delete
BEFORE DELETE ON company_grade_award_archives
BEGIN
  SELECT RAISE(ABORT, 'company grade award archives are immutable');
END;

CREATE TRIGGER company_grade_award_archive_no_update
BEFORE UPDATE ON company_grade_award_archives
BEGIN
  SELECT RAISE(ABORT, 'company grade award archives are immutable');
END;

CREATE TRIGGER company_grade_award_archives_identity_update
BEFORE UPDATE OF id ON company_grade_award_archives
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

CREATE TRIGGER company_legacy_personnel_action_write_guard
BEFORE INSERT ON company_resource_revisions
WHEN NEW.resource_type = 'personnel-action'
BEGIN
  SELECT RAISE(ABORT, 'company_legacy_personnel_action_write_retired');
END;

CREATE TRIGGER company_lifecycle_outbox_entries_identity_update
BEFORE UPDATE OF id, legacy_id ON company_lifecycle_outbox_entries
WHEN NEW.id IS NOT OLD.id OR NEW.legacy_id IS NOT OLD.legacy_id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

CREATE TRIGGER company_lifecycle_outbox_entries_legacy_id_insert
BEFORE INSERT ON company_lifecycle_outbox_entries
WHEN NEW.legacy_id IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'record_legacy_id_immutable'); END;

CREATE TRIGGER company_office_assignment_reference_guard
BEFORE INSERT ON company_resource_revisions
WHEN NEW.resource_type = 'office-assignment'
  AND NEW.state = 'active'
  AND (
    NOT EXISTS (
      SELECT 1 FROM company_resource_revisions AS employee
      WHERE employee.organization_id = NEW.organization_id
        AND employee.resource_type = 'employee'
        AND employee.resource_id = json_extract(NEW.attributes_json, '$.employeeId')
        AND employee.state = 'active'
    )
    OR NOT EXISTS (
      SELECT 1 FROM company_resource_revisions AS employment
      WHERE employment.organization_id = NEW.organization_id
        AND employment.resource_type = 'employment'
        AND employment.resource_id = json_extract(NEW.attributes_json, '$.employmentId')
        AND employment.state = 'active'
    )
    OR NOT EXISTS (
      SELECT 1 FROM company_resource_revisions AS office
      WHERE office.organization_id = NEW.organization_id
        AND office.resource_type = 'organizational-office'
        AND office.resource_id = json_extract(NEW.attributes_json, '$.organizationalOfficeId')
        AND office.state = 'active'
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'company_office_assignment_reference_not_found');
END;

CREATE TRIGGER company_organization_assignment_period_versions_guard
BEFORE INSERT ON company_organization_assignment_period_versions
BEGIN
  SELECT RAISE(ABORT, 'organization change operation is missing or stale')
  WHERE NOT EXISTS (
    SELECT 1
    FROM company_organization_change_operations operation
    JOIN company_organization_lifecycle_states state ON state.id = 1
    WHERE operation.id = NEW.recorded_by_action_id
      AND operation.status = 'PENDING'
      AND operation.applied_count < operation.change_count
      AND state.revision = operation.expected_revision + operation.applied_count
  );

  SELECT RAISE(ABORT, 'organization assignment revision is not sequential')
  WHERE NEW.revision != coalesce(
    (
      SELECT max(revision)
      FROM company_organization_assignment_period_versions
      WHERE period_id = NEW.period_id
    ),
    0
  ) + 1;

  SELECT RAISE(ABORT, 'organization assignment owner is immutable')
  WHERE EXISTS (
    SELECT 1 FROM company_organization_assignment_period_versions previous
    WHERE previous.period_id = NEW.period_id
      AND (
        previous.employment_id != NEW.employment_id
        OR previous.employee_id != NEW.employee_id
        OR previous.organization_unit_id != NEW.organization_unit_id
        OR previous.assignment_type != NEW.assignment_type
      )
  );

  SELECT RAISE(ABORT, 'organization assignment employment mismatch')
  WHERE NOT EXISTS (
    SELECT 1 FROM company_employments employment
    WHERE employment.id = NEW.employment_id
      AND employment.employee_id = NEW.employee_id
      AND employment.hire_date <= NEW.starts_on
      AND (
        employment.termination_date IS NULL
        OR (
          NEW.ends_on IS NOT NULL
          AND NEW.ends_on <= date(employment.termination_date, '+1 day')
        )
      )
  );

  SELECT RAISE(ABORT, 'organization assignment unit is not active')
  WHERE NEW.is_void = 0 AND NOT EXISTS (
    SELECT 1 FROM company_organization_unit_coverage unit
    WHERE unit.organization_unit_id = NEW.organization_unit_id
      AND unit.starts_on <= NEW.starts_on
      AND (
        unit.ends_on IS NULL
        OR (NEW.ends_on IS NOT NULL AND NEW.ends_on <= unit.ends_on)
      )
  );

  SELECT RAISE(ABORT, 'organization assignment overlaps')
  WHERE NEW.is_void = 0 AND EXISTS (
    SELECT 1 FROM company_organization_assignment_period_versions current
    WHERE current.period_id != NEW.period_id
      AND current.employee_id = NEW.employee_id
      AND current.is_void = 0
      AND current.revision = (
        SELECT max(latest.revision)
        FROM company_organization_assignment_period_versions latest
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
      SELECT 1 FROM company_employments manager_employment
      WHERE manager_employment.employee_id = NEW.manager_employee_id
        AND manager_employment.hire_date <= NEW.starts_on
        AND (
          manager_employment.termination_date IS NULL
          OR (
            NEW.ends_on IS NOT NULL
            AND NEW.ends_on <= date(manager_employment.termination_date, '+1 day')
          )
        )
    );
END;

CREATE TRIGGER company_organization_assignment_period_versions_identity_update
BEFORE UPDATE OF id ON company_organization_assignment_period_versions
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

CREATE TRIGGER company_organization_assignment_period_versions_immutable_delete
BEFORE DELETE ON company_organization_assignment_period_versions
BEGIN
  SELECT RAISE(ABORT, 'organization assignments are append only');
END;

CREATE TRIGGER company_organization_assignment_period_versions_immutable_update
BEFORE UPDATE ON company_organization_assignment_period_versions
BEGIN
  SELECT RAISE(ABORT, 'organization assignments are append only');
END;

CREATE TRIGGER company_organization_assignment_period_versions_revision_state
AFTER INSERT ON company_organization_assignment_period_versions
BEGIN
  UPDATE company_organization_change_operations
  SET applied_count = applied_count + 1
  WHERE id = NEW.recorded_by_action_id;

  UPDATE company_organization_lifecycle_states
  SET revision = revision + 1, updated_at = max(updated_at, NEW.recorded_at)
  WHERE id = 1;
END;

CREATE TRIGGER company_organization_assignment_source_completion_guard
BEFORE UPDATE OF status ON company_organization_change_operations
WHEN NEW.status = 'COMPLETED'
BEGIN
  SELECT RAISE(ABORT, 'organization assignment source is stale')
  WHERE EXISTS (
    SELECT 1 FROM company_assignment_period_bindings binding
    JOIN company_assignment_resource_bindings resource ON resource.resource_id = binding.resource_id
    JOIN company_organization_assignment_period_versions period ON period.period_id = binding.period_id
    WHERE period.revision = (SELECT max(latest.revision) FROM company_organization_assignment_period_versions latest WHERE latest.period_id = period.period_id)
      AND (period.revision != binding.period_revision OR period.employee_id != resource.employee_id
        OR period.manager_employee_id IS NOT NULL)
  );
  SELECT RAISE(ABORT, 'organization assignment public source is stale')
  WHERE EXISTS (
    SELECT 1 FROM company_assignment_resource_bindings binding
    WHERE NOT EXISTS (
      SELECT 1 FROM company_resource_heads head WHERE head.organization_id = binding.organization_id
        AND head.resource_type = 'assignment' AND head.resource_id = binding.resource_id
        AND head.revision = binding.resource_revision
    )
  );
END;

CREATE TRIGGER company_organization_change_operations_command_immutable
BEFORE UPDATE OF request_fingerprint, actor_account_id, reason, evidence_references_json
ON company_organization_change_operations
BEGIN
  SELECT RAISE(ABORT, 'organization change command is immutable');
END;

CREATE TRIGGER company_organization_change_operations_completed_count_immutable
BEFORE UPDATE OF applied_count ON company_organization_change_operations
WHEN OLD.status = 'COMPLETED'
BEGIN
  SELECT RAISE(ABORT, 'completed organization change operation is immutable');
END;

CREATE TRIGGER company_organization_change_operations_completion_guard
BEFORE UPDATE OF status ON company_organization_change_operations
BEGIN
  SELECT RAISE(ABORT, 'organization change operation is incomplete')
  WHERE OLD.status != 'PENDING'
    OR NEW.status != 'COMPLETED'
    OR NEW.applied_count != NEW.change_count
    OR NOT EXISTS (
      SELECT 1 FROM company_organization_lifecycle_states state
      WHERE state.id = 1 AND state.revision = NEW.resulting_revision
    );

  SELECT RAISE(ABORT, 'organization change leaves an orphan organization unit')
  WHERE EXISTS (
    SELECT 1 FROM company_organization_unit_period_versions child
    WHERE child.is_void = 0
      AND child.parent_organization_unit_id IS NOT NULL
      AND child.revision = (
        SELECT max(latest.revision)
        FROM company_organization_unit_period_versions latest
        WHERE latest.period_id = child.period_id
      )
      AND NOT EXISTS (
        SELECT 1 FROM company_organization_unit_coverage parent
        WHERE parent.organization_unit_id = child.parent_organization_unit_id
          AND parent.starts_on <= child.starts_on
          AND (
            parent.ends_on IS NULL
            OR (child.ends_on IS NOT NULL AND child.ends_on <= parent.ends_on)
          )
      )
  );

  SELECT RAISE(ABORT, 'organization change leaves an orphan assignment')
  WHERE EXISTS (
    SELECT 1 FROM company_organization_assignment_period_versions assignment
    WHERE assignment.is_void = 0
      AND assignment.revision = (
        SELECT max(latest.revision)
        FROM company_organization_assignment_period_versions latest
        WHERE latest.period_id = assignment.period_id
      )
      AND (
        NOT EXISTS (
          SELECT 1 FROM company_employments employment
          WHERE employment.id = assignment.employment_id
            AND employment.employee_id = assignment.employee_id
            AND employment.hire_date <= assignment.starts_on
            AND (
              employment.termination_date IS NULL
              OR (
                assignment.ends_on IS NOT NULL
                AND assignment.ends_on <= date(employment.termination_date, '+1 day')
              )
            )
        )
        OR NOT EXISTS (
          SELECT 1 FROM company_organization_unit_coverage unit
          WHERE unit.organization_unit_id = assignment.organization_unit_id
            AND unit.starts_on <= assignment.starts_on
            AND (
              unit.ends_on IS NULL
              OR (assignment.ends_on IS NOT NULL AND assignment.ends_on <= unit.ends_on)
            )
        )
      )
  );

  SELECT RAISE(ABORT, 'organization change leaves an orphan responsibility')
  WHERE EXISTS (
    SELECT 1 FROM company_organization_responsibility_period_versions responsibility
    WHERE responsibility.is_void = 0
      AND responsibility.revision = (
        SELECT max(latest.revision)
        FROM company_organization_responsibility_period_versions latest
        WHERE latest.period_id = responsibility.period_id
      )
      AND NOT EXISTS (
        SELECT 1 FROM company_organization_assignment_coverage assignment
        WHERE assignment.employment_id = responsibility.employment_id
          AND assignment.employee_id = responsibility.employee_id
          AND assignment.organization_unit_id = responsibility.organization_unit_id
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

CREATE TRIGGER company_organization_change_operations_identity_update
BEFORE UPDATE OF id, legacy_id ON company_organization_change_operations
WHEN NEW.id IS NOT OLD.id OR NEW.legacy_id IS NOT OLD.legacy_id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

CREATE TRIGGER company_organization_change_operations_immutable
BEFORE UPDATE OF id, expected_revision, change_count, resulting_revision, recorded_at
ON company_organization_change_operations
BEGIN
  SELECT RAISE(ABORT, 'organization change operation is immutable');
END;

CREATE TRIGGER company_organization_change_operations_immutable_delete
BEFORE DELETE ON company_organization_change_operations
BEGIN
  SELECT RAISE(ABORT, 'organization change operations are append only');
END;

CREATE TRIGGER company_organization_change_operations_insert_guard
BEFORE INSERT ON company_organization_change_operations
BEGIN
  SELECT RAISE(ABORT, 'organization revision conflict')
  WHERE NEW.applied_count != 0
    OR NEW.status != 'PENDING'
    OR NOT EXISTS (
      SELECT 1 FROM company_organization_lifecycle_states state
      WHERE state.id = 1 AND state.revision = NEW.expected_revision
    );
END;

CREATE TRIGGER company_organization_change_operations_legacy_id_insert
BEFORE INSERT ON company_organization_change_operations
WHEN NEW.legacy_id IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'record_legacy_id_immutable'); END;

CREATE TRIGGER company_organization_resource_adoptions_identity_update
BEFORE UPDATE OF id ON company_organization_resource_adoptions
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

CREATE TRIGGER company_organization_resource_adoptions_no_delete
BEFORE DELETE ON company_organization_resource_adoptions
BEGIN
  SELECT RAISE(ABORT, 'organization resource connection is immutable');
END;

CREATE TRIGGER company_organization_resource_adoptions_no_update
BEFORE UPDATE ON company_organization_resource_adoptions
BEGIN
  SELECT RAISE(ABORT, 'organization resource connection is immutable');
END;

CREATE TRIGGER company_organization_resource_binding_guard
AFTER INSERT ON company_organization_resource_bindings
WHEN 1
BEGIN
  SELECT RAISE(ABORT, 'organization resource history mismatch')
  WHERE EXISTS (SELECT 1 FROM company_organization_resource_mismatches WHERE organization_unit_id = NEW.organization_unit_id) OR NOT EXISTS (SELECT 1 FROM company_organization_unit_period_versions WHERE organization_unit_id = NEW.organization_unit_id);
END;

CREATE TRIGGER company_organization_resource_bindings_no_delete
BEFORE DELETE ON company_organization_resource_bindings
BEGIN
  SELECT RAISE(ABORT, 'organization resource connection is immutable');
END;

CREATE TRIGGER company_organization_resource_bindings_no_update
BEFORE UPDATE ON company_organization_resource_bindings
BEGIN
  SELECT RAISE(ABORT, 'organization resource connection is immutable');
END;

CREATE TRIGGER company_organization_resource_commit_guard
BEFORE UPDATE OF revision ON company_organizations
WHEN NEW.id = 'ad4f6cb1-774b-43ae-950f-80e9bc67c66d'
BEGIN
  SELECT RAISE(ABORT, 'organization resource history mismatch')
  WHERE EXISTS (SELECT 1 FROM company_organization_resource_mismatches);
END;

CREATE TRIGGER company_organization_resource_operation_commit_guard
BEFORE UPDATE OF revision ON company_organizations
WHEN NEW.revision != OLD.revision
BEGIN
  SELECT RAISE(ABORT, 'organization change operation is incomplete')
  WHERE EXISTS (
    SELECT 1 FROM company_command_receipts receipt
    JOIN company_organization_change_operations operation
      ON operation.id = (SELECT key_operation.id FROM company_organization_change_operations key_operation WHERE key_operation.operation_key = 'org-resource:' || receipt.fingerprint)
    WHERE receipt.organization_id = NEW.id AND receipt.organization_revision = NEW.revision
      AND operation.status != 'COMPLETED'
  );
END;

CREATE TRIGGER company_organization_resource_operation_guard
BEFORE UPDATE OF status ON company_organization_change_operations
WHEN NEW.status = 'COMPLETED'
BEGIN
  SELECT RAISE(ABORT, 'organization resource history mismatch')
  WHERE EXISTS (SELECT 1 FROM company_organization_resource_mismatches);
END;

CREATE TRIGGER company_organization_responsibility_period_versions_guard
BEFORE INSERT ON company_organization_responsibility_period_versions
BEGIN
  SELECT RAISE(ABORT, 'organization change operation is missing or stale')
  WHERE NOT EXISTS (
    SELECT 1
    FROM company_organization_change_operations operation
    JOIN company_organization_lifecycle_states state ON state.id = 1
    WHERE operation.id = NEW.recorded_by_action_id
      AND operation.status = 'PENDING'
      AND operation.applied_count < operation.change_count
      AND state.revision = operation.expected_revision + operation.applied_count
  );

  SELECT RAISE(ABORT, 'organization responsibility revision is not sequential')
  WHERE NEW.revision != coalesce(
    (
      SELECT max(revision)
      FROM company_organization_responsibility_period_versions
      WHERE period_id = NEW.period_id
    ),
    0
  ) + 1;

  SELECT RAISE(ABORT, 'organization responsibility owner is immutable')
  WHERE EXISTS (
    SELECT 1 FROM company_organization_responsibility_period_versions previous
    WHERE previous.period_id = NEW.period_id
      AND (
        previous.employment_id != NEW.employment_id
        OR previous.employee_id != NEW.employee_id
        OR previous.organization_unit_id != NEW.organization_unit_id
        OR previous.responsibility_type != NEW.responsibility_type
      )
  );

  SELECT RAISE(ABORT, 'organization responsibility employment mismatch')
  WHERE NOT EXISTS (
    SELECT 1 FROM company_employments employment
    WHERE employment.id = NEW.employment_id
      AND employment.employee_id = NEW.employee_id
      AND employment.hire_date <= NEW.starts_on
      AND (
        employment.termination_date IS NULL
        OR (
          NEW.ends_on IS NOT NULL
          AND NEW.ends_on <= date(employment.termination_date, '+1 day')
        )
      )
  );

  SELECT RAISE(ABORT, 'organization responsibility unit is not active')
  WHERE NEW.is_void = 0 AND NOT EXISTS (
    SELECT 1 FROM company_organization_unit_coverage unit
    WHERE unit.organization_unit_id = NEW.organization_unit_id
      AND unit.starts_on <= NEW.starts_on
      AND (
        unit.ends_on IS NULL
        OR (NEW.ends_on IS NOT NULL AND NEW.ends_on <= unit.ends_on)
      )
  );

  SELECT RAISE(ABORT, 'organization responsibility requires matching assignment')
  WHERE NEW.is_void = 0 AND NOT EXISTS (
    SELECT 1 FROM company_organization_assignment_coverage assignment
    WHERE assignment.employment_id = NEW.employment_id
      AND assignment.employee_id = NEW.employee_id
      AND assignment.organization_unit_id = NEW.organization_unit_id
      AND assignment.starts_on <= NEW.starts_on
      AND (
        assignment.ends_on IS NULL
        OR (NEW.ends_on IS NOT NULL AND NEW.ends_on <= assignment.ends_on)
      )
  );

  SELECT RAISE(ABORT, 'organization responsibility overlaps')
  WHERE NEW.is_void = 0 AND EXISTS (
    SELECT 1 FROM company_organization_responsibility_period_versions current
    WHERE current.period_id != NEW.period_id
      AND current.employee_id = NEW.employee_id
      AND current.organization_unit_id = NEW.organization_unit_id
      AND current.responsibility_type = NEW.responsibility_type
      AND current.is_void = 0
      AND current.revision = (
        SELECT max(latest.revision)
        FROM company_organization_responsibility_period_versions latest
        WHERE latest.period_id = current.period_id
      )
      AND (current.ends_on IS NULL OR NEW.starts_on < current.ends_on)
      AND (NEW.ends_on IS NULL OR current.starts_on < NEW.ends_on)
  );
END;

CREATE TRIGGER company_organization_responsibility_period_versions_identity_update
BEFORE UPDATE OF id ON company_organization_responsibility_period_versions
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

CREATE TRIGGER company_organization_responsibility_period_versions_immutable_delete
BEFORE DELETE ON company_organization_responsibility_period_versions
BEGIN
  SELECT RAISE(ABORT, 'organization responsibilities are append only');
END;

CREATE TRIGGER company_organization_responsibility_period_versions_immutable_update
BEFORE UPDATE ON company_organization_responsibility_period_versions
BEGIN
  SELECT RAISE(ABORT, 'organization responsibilities are append only');
END;

CREATE TRIGGER company_organization_responsibility_period_versions_revision_state
AFTER INSERT ON company_organization_responsibility_period_versions
BEGIN
  UPDATE company_organization_change_operations
  SET applied_count = applied_count + 1
  WHERE id = NEW.recorded_by_action_id;

  UPDATE company_organization_lifecycle_states
  SET revision = revision + 1, updated_at = max(updated_at, NEW.recorded_at)
  WHERE id = 1;
END;

CREATE TRIGGER company_organization_unit_period_versions_identity_update
BEFORE UPDATE OF id ON company_organization_unit_period_versions
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

CREATE TRIGGER company_organization_unit_period_versions_immutable_delete
BEFORE DELETE ON company_organization_unit_period_versions
BEGIN
  SELECT RAISE(ABORT, 'organization unit periods are append only');
END;

CREATE TRIGGER company_organization_unit_period_versions_immutable_update
BEFORE UPDATE ON company_organization_unit_period_versions
BEGIN
  SELECT RAISE(ABORT, 'organization unit periods are append only');
END;

CREATE TRIGGER company_organization_unit_period_versions_revision_guard
BEFORE INSERT ON company_organization_unit_period_versions
BEGIN
  SELECT RAISE(ABORT, 'organization change operation is missing or stale')
  WHERE NOT EXISTS (
    SELECT 1
    FROM company_organization_change_operations operation
    JOIN company_organization_lifecycle_states state ON state.id = 1
    WHERE operation.id = NEW.recorded_by_action_id
      AND operation.status = 'PENDING'
      AND operation.applied_count < operation.change_count
      AND state.revision = operation.expected_revision + operation.applied_count
  );

  SELECT RAISE(ABORT, 'organization unit revision is not sequential')
  WHERE NEW.revision != coalesce(
    (
      SELECT max(revision)
      FROM company_organization_unit_period_versions
      WHERE period_id = NEW.period_id
    ),
    0
  ) + 1;

  SELECT RAISE(ABORT, 'organization unit period owner is immutable')
  WHERE EXISTS (
    SELECT 1 FROM company_organization_unit_period_versions previous
    WHERE previous.period_id = NEW.period_id
      AND previous.organization_unit_id != NEW.organization_unit_id
  );

  SELECT RAISE(ABORT, 'organization root requires canonical parent')
  WHERE (NEW.kind = 'COMPANY' AND NEW.parent_organization_unit_id IS NOT NULL)
     OR (NEW.kind != 'COMPANY' AND NEW.parent_organization_unit_id IS NULL);

  SELECT RAISE(ABORT, 'organization unit period overlaps')
  WHERE NEW.is_void = 0 AND EXISTS (
    SELECT 1 FROM company_organization_unit_period_versions current
    WHERE current.period_id != NEW.period_id
      AND current.organization_unit_id = NEW.organization_unit_id
      AND current.is_void = 0
      AND current.revision = (
        SELECT max(latest.revision)
        FROM company_organization_unit_period_versions latest
        WHERE latest.period_id = current.period_id
      )
      AND (current.ends_on IS NULL OR NEW.starts_on < current.ends_on)
      AND (NEW.ends_on IS NULL OR current.starts_on < NEW.ends_on)
  );

  SELECT RAISE(ABORT, 'organization unit code overlaps')
  WHERE NEW.is_void = 0 AND EXISTS (
    SELECT 1 FROM company_organization_unit_period_versions current
    WHERE current.period_id != NEW.period_id
      AND current.organization_unit_id != NEW.organization_unit_id
      AND current.code = NEW.code
      AND current.is_void = 0
      AND current.revision = (
        SELECT max(latest.revision)
        FROM company_organization_unit_period_versions latest
        WHERE latest.period_id = current.period_id
      )
      AND (current.ends_on IS NULL OR NEW.starts_on < current.ends_on)
      AND (NEW.ends_on IS NULL OR current.starts_on < NEW.ends_on)
  );

  SELECT RAISE(ABORT, 'company root period overlaps')
  WHERE NEW.is_void = 0 AND NEW.kind = 'COMPANY' AND EXISTS (
    SELECT 1 FROM company_organization_unit_period_versions current
    WHERE current.period_id != NEW.period_id
      AND current.kind = 'COMPANY'
      AND current.is_void = 0
      AND current.revision = (
        SELECT max(latest.revision)
        FROM company_organization_unit_period_versions latest
        WHERE latest.period_id = current.period_id
      )
      AND (current.ends_on IS NULL OR NEW.starts_on < current.ends_on)
      AND (NEW.ends_on IS NULL OR current.starts_on < NEW.ends_on)
  );
END;

CREATE TRIGGER company_organization_unit_period_versions_revision_state
AFTER INSERT ON company_organization_unit_period_versions
BEGIN
  UPDATE company_organization_change_operations
  SET applied_count = applied_count + 1
  WHERE id = NEW.recorded_by_action_id;

  UPDATE company_organization_lifecycle_states
  SET revision = revision + 1, updated_at = max(updated_at, NEW.recorded_at)
  WHERE id = 1;
END;

CREATE TRIGGER company_organization_units_identity_update
BEFORE UPDATE OF id, legacy_id ON company_organization_units
WHEN NEW.id IS NOT OLD.id OR NEW.legacy_id IS NOT OLD.legacy_id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

CREATE TRIGGER company_organization_units_immutable_delete
BEFORE DELETE ON company_organization_units
BEGIN
  SELECT RAISE(ABORT, 'organization unit identity is append only');
END;

CREATE TRIGGER company_organization_units_immutable_update
BEFORE UPDATE ON company_organization_units
BEGIN
  SELECT RAISE(ABORT, 'organization unit identity is immutable');
END;

CREATE TRIGGER company_organization_units_legacy_id_insert
BEFORE INSERT ON company_organization_units
WHEN NEW.legacy_id IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'record_legacy_id_immutable'); END;

CREATE TRIGGER company_organizational_authority_scope_guard
BEFORE INSERT ON company_resource_revisions
WHEN NEW.resource_type = 'organizational-authority'
  AND NEW.state = 'active'
  AND json_extract(NEW.attributes_json, '$.scopeType') = 'authority-scope'
  AND NOT EXISTS (
    SELECT 1 FROM company_resource_revisions AS scope
    WHERE scope.organization_id = NEW.organization_id
      AND scope.resource_type = 'authority-scope'
      AND scope.resource_id = json_extract(NEW.attributes_json, '$.scopeId')
      AND scope.state = 'active'
  )
BEGIN
  SELECT RAISE(ABORT, 'company_organizational_authority_scope_not_found');
END;

CREATE TRIGGER company_organizational_office_reference_guard
BEFORE INSERT ON company_resource_revisions
WHEN NEW.resource_type = 'organizational-office'
  AND NEW.state = 'active'
  AND (
    NOT EXISTS (
      SELECT 1
      FROM company_resource_revisions AS unit
      WHERE unit.organization_id = NEW.organization_id
        AND unit.resource_type = 'organization-unit'
        AND json_extract(unit.attributes_json, '$.organizationUnitId') = json_extract(NEW.attributes_json, '$.organizationUnitId')
        AND unit.state = 'active'
    )
    OR NOT EXISTS (
      SELECT 1
      FROM company_resource_revisions AS position
      WHERE position.organization_id = NEW.organization_id
        AND position.resource_type = 'position'
        AND position.resource_id = json_extract(NEW.attributes_json, '$.positionId')
        AND position.state = 'active'
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'company_governance_organization_reference_invalid');
END;

CREATE TRIGGER company_organizations_identity_update
BEFORE UPDATE OF id, legacy_id ON company_organizations
WHEN NEW.id IS NOT OLD.id OR NEW.legacy_id IS NOT OLD.legacy_id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

CREATE TRIGGER company_organizations_legacy_id_insert
BEFORE INSERT ON company_organizations
WHEN NEW.legacy_id IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'record_legacy_id_immutable'); END;

CREATE TRIGGER company_organizations_revision_step
BEFORE UPDATE OF revision ON company_organizations
WHEN NEW.revision <> OLD.revision + 1
BEGIN
  SELECT RAISE(ABORT, 'company_revision_step_invalid');
END;

CREATE TRIGGER company_personnel_action_requests_immutable_proposal
BEFORE UPDATE ON company_personnel_action_requests
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

CREATE TRIGGER company_personnel_action_requests_system_proposal_insert
BEFORE INSERT ON company_personnel_action_requests
WHEN
  NEW.system_proposal_series_id IS NULL
  OR NEW.payload_fingerprint IS NULL
  OR NOT EXISTS (
    SELECT 1
    FROM system_proposal_numbers number
    JOIN system_proposal_series series ON series.id = number.series_id
    WHERE number.number = NEW.application_id
      AND number.series_id = NEW.system_proposal_series_id
      AND series.procedure_key = 'personnel_action_request'
  )
  OR NOT EXISTS (
    SELECT 1
    FROM system_proposals proposal
    WHERE proposal.series_id = NEW.system_proposal_series_id
      AND proposal.body_json = NEW.payload_json
  )
BEGIN
  SELECT RAISE(ABORT, 'personnel action requires matching System proposal');
END;

CREATE TRIGGER company_personnel_actions_identity_update
BEFORE UPDATE OF id, legacy_id ON company_personnel_actions
WHEN NEW.id IS NOT OLD.id OR NEW.legacy_id IS NOT OLD.legacy_id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

CREATE TRIGGER company_personnel_actions_legacy_id_insert
BEFORE INSERT ON company_personnel_actions
WHEN NEW.legacy_id IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'record_legacy_id_immutable'); END;

CREATE TRIGGER company_personnel_actions_no_delete
BEFORE DELETE ON company_personnel_actions
BEGIN
  SELECT RAISE(ABORT, 'company personnel actions are append only');
END;

CREATE TRIGGER company_personnel_actions_no_update
BEFORE UPDATE ON company_personnel_actions
BEGIN
  SELECT RAISE(ABORT, 'company personnel actions are append only');
END;

CREATE TRIGGER company_personnel_annotations_identity_update
BEFORE UPDATE OF id, legacy_id ON company_personnel_annotations
WHEN NEW.id IS NOT OLD.id OR NEW.legacy_id IS NOT OLD.legacy_id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

CREATE TRIGGER company_personnel_annotations_legacy_id_insert
BEFORE INSERT ON company_personnel_annotations
WHEN NEW.legacy_id IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'record_legacy_id_immutable'); END;

CREATE TRIGGER company_personnel_annotations_no_delete
BEFORE DELETE ON company_personnel_annotations
BEGIN
  SELECT RAISE(ABORT, 'company personnel annotations are immutable');
END;

CREATE TRIGGER company_personnel_annotations_no_replace
BEFORE INSERT ON company_personnel_annotations
WHEN EXISTS (SELECT 1 FROM company_personnel_annotations WHERE id = NEW.id)
BEGIN
  SELECT RAISE(ABORT, 'company personnel annotations are immutable');
END;

CREATE TRIGGER company_personnel_annotations_no_update
BEFORE UPDATE ON company_personnel_annotations
BEGIN
  SELECT RAISE(ABORT, 'company personnel annotations are immutable');
END;

CREATE TRIGGER company_personnel_reporting_binding_delete_guard
BEFORE DELETE ON company_personnel_reporting_bindings
BEGIN
  SELECT RAISE(ABORT, 'company personnel reporting binding is immutable');
END;

CREATE TRIGGER company_personnel_reporting_binding_insert_guard
BEFORE INSERT ON company_personnel_reporting_bindings
BEGIN
  SELECT RAISE(ABORT, 'company personnel reporting owner does not match')
  WHERE NOT EXISTS (
    SELECT 1 FROM company_resource_heads resource
    JOIN company_employments employment ON employment.id = NEW.employment_id
    WHERE resource.organization_id = NEW.organization_id AND resource.resource_type = 'reporting-relation'
      AND resource.resource_id = NEW.resource_id AND employment.employee_id = NEW.employee_id
      AND json_extract(resource.attributes_json, '$.employeeId') = NEW.employee_id
      AND json_extract(resource.attributes_json, '$.organizationUnitId') = NEW.organization_unit_id
  );
END;

CREATE TRIGGER company_personnel_reporting_binding_update_guard
BEFORE UPDATE ON company_personnel_reporting_bindings
BEGIN
  SELECT RAISE(ABORT, 'company personnel reporting binding is immutable');
END;

CREATE TRIGGER company_personnel_reporting_commit_guard
BEFORE UPDATE OF revision ON company_organizations
WHEN NEW.revision != OLD.revision AND NOT EXISTS (
  SELECT 1 FROM company_organization_change_operations WHERE status = 'PENDING'
)
BEGIN
  SELECT RAISE(ABORT, 'company personnel reporting assignment period is not covered')
  WHERE EXISTS (
    SELECT 1 FROM company_personnel_reporting_periods reporting
    WHERE NOT EXISTS (
      SELECT 1 FROM company_personnel_reporting_assignment_coverage assignment
      WHERE assignment.employee_id = reporting.employee_id AND assignment.employment_id = reporting.employment_id
        AND assignment.organization_unit_id = reporting.organization_unit_id
        AND assignment.assignment_type = reporting.assignment_type
        AND assignment.starts_on <= reporting.starts_on
        AND (assignment.ends_on IS NULL OR
          (reporting.ends_on IS NOT NULL AND reporting.ends_on <= assignment.ends_on))
    )
  );
END;

CREATE TRIGGER company_personnel_reporting_completion_guard
BEFORE UPDATE OF status ON company_organization_change_operations
WHEN NEW.status = 'COMPLETED'
BEGIN
  SELECT RAISE(ABORT, 'company personnel reporting assignment period is not covered')
  WHERE EXISTS (
    SELECT 1 FROM company_personnel_reporting_periods reporting
    WHERE NOT EXISTS (
      SELECT 1 FROM company_personnel_reporting_assignment_coverage assignment
      WHERE assignment.employee_id = reporting.employee_id AND assignment.employment_id = reporting.employment_id
        AND assignment.organization_unit_id = reporting.organization_unit_id
        AND assignment.assignment_type = reporting.assignment_type
        AND assignment.starts_on <= reporting.starts_on
        AND (assignment.ends_on IS NULL OR
          (reporting.ends_on IS NOT NULL AND reporting.ends_on <= assignment.ends_on))
    )
  );
END;

CREATE TRIGGER company_personnel_reporting_coverage_insert_guard
AFTER INSERT ON company_personnel_reporting_bindings
BEGIN
  SELECT RAISE(ABORT, 'company personnel reporting assignment period is not covered')
  WHERE EXISTS (
    SELECT 1 FROM company_personnel_reporting_periods reporting
    WHERE NOT EXISTS (
      SELECT 1 FROM company_personnel_reporting_assignment_coverage assignment
      WHERE assignment.employee_id = reporting.employee_id AND assignment.employment_id = reporting.employment_id
        AND assignment.organization_unit_id = reporting.organization_unit_id
        AND assignment.assignment_type = reporting.assignment_type
        AND assignment.starts_on <= reporting.starts_on
        AND (assignment.ends_on IS NULL OR
          (reporting.ends_on IS NOT NULL AND reporting.ends_on <= assignment.ends_on))
    )
  );
END;

CREATE TRIGGER company_personnel_reporting_owner_guard
BEFORE UPDATE ON company_resource_heads
WHEN OLD.resource_type = 'reporting-relation'
  AND EXISTS (SELECT 1 FROM company_personnel_reporting_bindings binding
    WHERE binding.resource_id = OLD.resource_id AND binding.organization_id = OLD.organization_id)
BEGIN
  SELECT RAISE(ABORT, 'company personnel reporting owner is immutable')
  WHERE NEW.organization_id IS NOT OLD.organization_id OR NEW.resource_type IS NOT OLD.resource_type
    OR NEW.resource_id IS NOT OLD.resource_id
    OR json_extract(NEW.attributes_json, '$.employeeId') IS NOT json_extract(OLD.attributes_json, '$.employeeId')
    OR json_extract(NEW.attributes_json, '$.organizationUnitId') IS NOT json_extract(OLD.attributes_json, '$.organizationUnitId');
END;

CREATE TRIGGER company_place_reference_period_commit_guard
BEFORE UPDATE OF revision ON company_organizations
BEGIN
  SELECT RAISE(ABORT, 'company_place_reference_period_not_covered')
  WHERE EXISTS (SELECT 1 FROM company_place_reference_period_violations WHERE organization_id = NEW.id);
END;

CREATE TRIGGER company_position_job_guard
BEFORE INSERT ON company_resource_revisions
WHEN NEW.resource_type = 'position'
  AND NEW.state = 'active'
  AND json_extract(NEW.attributes_json, '$.jobId') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM company_resource_revisions AS job
    WHERE job.organization_id = NEW.organization_id
      AND job.resource_type = 'job'
      AND job.resource_id = json_extract(NEW.attributes_json, '$.jobId')
      AND job.state = 'active'
  )
BEGIN
  SELECT RAISE(ABORT, 'company_position_job_not_found');
END;

CREATE TRIGGER company_profile_change_receipts_identity_update
BEFORE UPDATE OF id ON company_profile_change_receipts
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

CREATE TRIGGER company_profile_change_receipts_immutable_delete
BEFORE DELETE ON company_profile_change_receipts
BEGIN
  SELECT RAISE(ABORT, 'company profile change receipt is immutable');
END;

CREATE TRIGGER company_profile_change_receipts_immutable_update
BEFORE UPDATE ON company_profile_change_receipts
BEGIN
  SELECT RAISE(ABORT, 'company profile change receipt is immutable');
END;

CREATE TRIGGER company_profile_legacy_write_guard
BEFORE UPDATE OF name, representative_name ON company_organizations
WHEN (NEW.name IS NOT OLD.name OR NEW.representative_name IS NOT OLD.representative_name)
AND EXISTS (SELECT 1 FROM company_resource_heads WHERE organization_id = OLD.id AND resource_type = 'company-profile')
BEGIN
  SELECT RAISE(ABORT, 'company profile legacy write is not canonical');
END;

CREATE TRIGGER company_reporting_employment_commit_guard
AFTER UPDATE OF revision ON company_organizations
WHEN NOT EXISTS (
  SELECT 1 FROM company_workforce_resource_bindings binding
  JOIN company_employee_lifecycle_revisions lifecycle ON lifecycle.employee_id = binding.employee_id
  WHERE binding.organization_id = NEW.id AND binding.resource_type = 'employee'
    AND binding.lifecycle_revision != lifecycle.revision
)
BEGIN
  SELECT RAISE(ABORT, 'company reporting employment period is not covered')
  WHERE EXISTS (SELECT 1 FROM company_reporting_employment_violations WHERE organization_id = NEW.id);
END;

CREATE TRIGGER company_reporting_employment_projection_guard
AFTER UPDATE OF lifecycle_revision ON company_workforce_resource_bindings
WHEN NEW.resource_type = 'employee' AND NEW.lifecycle_revision = (
  SELECT revision FROM company_employee_lifecycle_revisions WHERE employee_id = NEW.employee_id
)
BEGIN
  SELECT RAISE(ABORT, 'company reporting employment period is not covered')
  WHERE EXISTS (SELECT 1 FROM company_reporting_employment_violations
    WHERE organization_id = NEW.organization_id AND employee_id = NEW.employee_id);
END;

CREATE TRIGGER company_reporting_reference_period_commit_guard
BEFORE UPDATE OF revision ON company_organizations
WHEN NEW.revision != OLD.revision
BEGIN
  SELECT RAISE(ABORT, 'company_reporting_reference_period_not_covered')
  WHERE EXISTS (SELECT 1 FROM company_reporting_reference_period_violations WHERE organization_id = NEW.id);
END;

CREATE TRIGGER company_resource_heads_identity_update
BEFORE UPDATE OF id ON company_resource_heads
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

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

CREATE TRIGGER company_resource_revisions_identity_update
BEFORE UPDATE OF id ON company_resource_revisions
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

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

CREATE TRIGGER company_responsibility_adoption_completion_guard
BEFORE UPDATE OF status ON company_organization_change_operations
WHEN NEW.status = 'COMPLETED' AND NEW.operation_key GLOB 'responsibility-adoption:*'
BEGIN
  SELECT RAISE(ABORT, 'responsibility adoption evidence is missing')
  WHERE NOT EXISTS (SELECT 1 FROM company_responsibility_resource_adoptions adoption WHERE adoption.operation_id = NEW.id);
END;

CREATE TRIGGER company_responsibility_adoption_delete_guard
BEFORE DELETE ON company_responsibility_resource_adoptions
BEGIN
  SELECT RAISE(ABORT, 'responsibility adoption evidence is immutable');
END;

CREATE TRIGGER company_responsibility_adoption_insert_guard
BEFORE INSERT ON company_responsibility_resource_adoptions
BEGIN
  SELECT RAISE(ABORT, 'responsibility adoption evidence is incomplete') WHERE NOT EXISTS (
    SELECT 1 FROM company_organization_change_operations operation
    WHERE operation.id = NEW.operation_id AND operation.status = 'PENDING'
      AND operation.change_count = NEW.adopted_periods AND operation.applied_count = NEW.adopted_periods
      AND operation.actor_account_id = NEW.actor_account_id AND operation.reason = NEW.reason
  ) OR NEW.organization_revision != (SELECT revision FROM company_organizations WHERE id = 'ad4f6cb1-774b-43ae-950f-80e9bc67c66d')
  OR NEW.adopted_periods != (SELECT count(*) FROM company_organization_responsibility_period_versions period WHERE period.recorded_by_action_id = NEW.operation_id)
  OR EXISTS (
    SELECT 1 FROM company_organization_responsibility_period_versions period
    WHERE period.recorded_by_action_id = NEW.operation_id AND (
      period.employee_id != NEW.employee_id OR NOT EXISTS (
        SELECT 1 FROM company_responsibility_period_bindings binding
        JOIN company_responsibility_resource_bindings source ON source.resource_id = binding.resource_id
        JOIN json_each(NEW.mappings_json) mapping ON json_extract(mapping.value, '$.periodId') = period.period_id
        WHERE binding.period_id = period.period_id AND binding.period_revision = period.revision AND binding.source_revision = source.resource_revision
          AND source.resource_revision >= 1 AND source.employee_id = NEW.employee_id
          AND source.responsibility_id = json_extract(mapping.value, '$.responsibilityId')
          AND source.authority_scope_id = json_extract(mapping.value, '$.authorityScopeId')
          AND EXISTS (SELECT 1 FROM company_resource_revisions applied
            WHERE applied.organization_id = source.organization_id
              AND applied.resource_type = 'responsibility-assignment'
              AND applied.resource_id = source.resource_id AND applied.revision = source.resource_revision
              AND applied.organization_revision > NEW.expected_revision
              AND applied.organization_revision <= NEW.organization_revision
              AND applied.actor_account_id = NEW.actor_account_id AND applied.reason = NEW.reason)
          AND (
            (json_type(mapping.value, '$.existingResourceId') IS NULL AND source.resource_revision = 1)
            OR (json_extract(mapping.value, '$.existingResourceId') = source.resource_id
              AND source.resource_revision > 1
              AND source.resource_revision = 1 + (
                SELECT max(json_extract(confirmed.value, '$.revision'))
                FROM json_each(NEW.source_json, '$.publicResponsibilities') confirmed
                WHERE json_extract(confirmed.value, '$.resourceId') = source.resource_id
                  AND json_type(confirmed.value, '$.bindingEmployeeId') = 'null'
              ))
          )
      )
    )
  );
END;

CREATE TRIGGER company_responsibility_adoption_update_guard
BEFORE UPDATE ON company_responsibility_resource_adoptions
BEGIN
  SELECT RAISE(ABORT, 'responsibility adoption evidence is immutable');
END;

CREATE TRIGGER company_responsibility_assignment_lifecycle_guard
AFTER UPDATE OF lifecycle_revision ON company_workforce_resource_bindings
WHEN NEW.resource_type = 'employee' AND NEW.lifecycle_revision != OLD.lifecycle_revision
BEGIN
  SELECT RAISE(ABORT, 'organization responsibility assignment periods overlap')
  WHERE EXISTS (SELECT 1 FROM company_responsibility_assignment_overlaps
    WHERE organization_id = NEW.organization_id AND holder_type = 'employee' AND holder_id = NEW.employee_id);
END;

CREATE TRIGGER company_responsibility_assignment_operation_guard
BEFORE UPDATE OF status ON company_organization_change_operations
WHEN NEW.status = 'COMPLETED'
BEGIN
  SELECT RAISE(ABORT, 'organization responsibility assignment periods overlap')
  WHERE EXISTS (SELECT 1 FROM company_responsibility_assignment_overlaps);
END;

CREATE TRIGGER company_responsibility_assignment_reference_guard
BEFORE INSERT ON company_resource_revisions
WHEN NEW.resource_type = 'responsibility-assignment'
  AND NEW.state = 'active'
  AND (
    NOT EXISTS (
      SELECT 1 FROM company_resource_revisions AS responsibility
      WHERE responsibility.organization_id = NEW.organization_id
        AND responsibility.resource_type = 'responsibility'
        AND responsibility.resource_id = json_extract(NEW.attributes_json, '$.responsibilityId')
        AND responsibility.state = 'active'
    )
    OR (
      json_extract(NEW.attributes_json, '$.authorityScopeId') IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM company_resource_revisions AS scope
        WHERE scope.organization_id = NEW.organization_id
          AND scope.resource_type = 'authority-scope'
          AND scope.resource_id = json_extract(NEW.attributes_json, '$.authorityScopeId')
          AND scope.state = 'active'
      )
    )
    OR NOT EXISTS (
      SELECT 1 FROM company_resource_revisions AS holder
      WHERE holder.organization_id = NEW.organization_id
        AND holder.resource_type = json_extract(NEW.attributes_json, '$.holderType')
        AND holder.resource_id = json_extract(NEW.attributes_json, '$.holderId')
        AND holder.state = 'active'
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'company_responsibility_assignment_reference_not_found');
END;

CREATE TRIGGER company_responsibility_assignment_revision_guard
BEFORE UPDATE OF revision ON company_organizations
WHEN NOT EXISTS (
  SELECT 1 FROM company_workforce_resource_bindings binding
  JOIN company_employee_lifecycle_revisions lifecycle ON lifecycle.employee_id = binding.employee_id
  WHERE binding.organization_id = NEW.id AND binding.resource_type = 'employee' AND binding.lifecycle_revision != lifecycle.revision
)
BEGIN
  SELECT RAISE(ABORT, 'organization responsibility assignment periods overlap')
  WHERE EXISTS (SELECT 1 FROM company_responsibility_assignment_overlaps WHERE organization_id = NEW.id);
END;

CREATE TRIGGER company_responsibility_lifecycle_completion_guard
AFTER UPDATE OF lifecycle_revision ON company_workforce_resource_bindings
WHEN NEW.resource_type = 'employee' AND NEW.lifecycle_revision != OLD.lifecycle_revision
BEGIN
  SELECT RAISE(ABORT, 'organization responsibility public source is stale')
  WHERE EXISTS (
    SELECT 1 FROM company_responsibility_source_mismatches mismatch
    JOIN company_responsibility_resource_bindings source ON source.resource_id = mismatch.resource_id
    WHERE source.employee_id = NEW.employee_id AND source.organization_id = NEW.organization_id
  );
END;

CREATE TRIGGER company_responsibility_period_binding_delete_guard
BEFORE DELETE ON company_responsibility_period_bindings
BEGIN
  SELECT RAISE(ABORT, 'organization responsibility period source is immutable');
END;

CREATE TRIGGER company_responsibility_period_binding_update_guard
BEFORE UPDATE ON company_responsibility_period_bindings
WHEN NEW.period_id != OLD.period_id OR NEW.resource_id != OLD.resource_id OR NEW.period_revision < OLD.period_revision
BEGIN
  SELECT RAISE(ABORT, 'organization responsibility period source is immutable');
END;

CREATE TRIGGER company_responsibility_resource_adoptions_identity_update
BEFORE UPDATE OF id ON company_responsibility_resource_adoptions
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

CREATE TRIGGER company_responsibility_resource_binding_delete_guard
BEFORE DELETE ON company_responsibility_resource_bindings
BEGIN
  SELECT RAISE(ABORT, 'organization responsibility source identity is immutable');
END;

CREATE TRIGGER company_responsibility_resource_binding_update_guard
BEFORE UPDATE ON company_responsibility_resource_bindings
WHEN NEW.resource_id != OLD.resource_id OR NEW.organization_id != OLD.organization_id
  OR NEW.employee_id != OLD.employee_id OR NEW.employment_id != OLD.employment_id
  OR NEW.organization_unit_id != OLD.organization_unit_id OR NEW.responsibility_type != OLD.responsibility_type
  OR NEW.responsibility_id != OLD.responsibility_id OR NEW.authority_scope_id != OLD.authority_scope_id
  OR NEW.resource_revision < OLD.resource_revision
BEGIN
  SELECT RAISE(ABORT, 'organization responsibility source identity is immutable');
END;

CREATE TRIGGER company_responsibility_source_adoptions_delete_guard
BEFORE DELETE ON company_responsibility_source_adoptions
BEGIN
  SELECT RAISE(ABORT, 'company_responsibility_source_adoption_immutable');
END;

CREATE TRIGGER company_responsibility_source_adoptions_identity_update
BEFORE UPDATE OF id ON company_responsibility_source_adoptions
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

CREATE TRIGGER company_responsibility_source_adoptions_insert_guard
BEFORE INSERT ON company_responsibility_source_adoptions
BEGIN
  SELECT RAISE(ABORT, 'company_responsibility_source_adoption_freeze_invalid')
  WHERE NOT EXISTS (
    SELECT 1 FROM system_record_source_freezes freeze
    WHERE freeze.id = NEW.freeze_id
      AND freeze.source_namespace = NEW.source_namespace
      AND freeze.owner_context = NEW.source_context
      AND freeze.revision = 1
  );

  SELECT RAISE(ABORT, 'company_responsibility_source_adoption_resource_invalid')
  WHERE NOT EXISTS (
    SELECT 1
    FROM company_resource_revisions resource
    JOIN company_command_receipts receipt
      ON receipt.organization_id = resource.organization_id
      AND receipt.command_id = resource.command_id
    WHERE resource.organization_id = NEW.organization_id
      AND resource.resource_type = NEW.resource_type
      AND resource.resource_id = NEW.resource_id
      AND resource.revision = NEW.resource_revision
      AND resource.command_id = NEW.command_id
      AND resource.organization_revision = NEW.organization_revision
      AND resource.actor_account_id = NEW.actor_account_id
      AND resource.reason = NEW.reason
      AND resource.recorded_at = NEW.recorded_at
      AND receipt.expected_revision = NEW.expected_revision
  );
END;

CREATE TRIGGER company_responsibility_source_adoptions_update_guard
BEFORE UPDATE ON company_responsibility_source_adoptions
BEGIN
  SELECT RAISE(ABORT, 'company_responsibility_source_adoption_immutable');
END;

CREATE TRIGGER company_responsibility_source_completion_guard
BEFORE UPDATE OF status ON company_organization_change_operations
WHEN NEW.status = 'COMPLETED'
BEGIN
  SELECT RAISE(ABORT, 'organization responsibility public source is stale')
  WHERE EXISTS (SELECT 1 FROM company_responsibility_source_mismatches);
END;

CREATE TRIGGER company_responsibility_source_cutovers_delete_guard
BEFORE DELETE ON company_responsibility_source_cutovers
BEGIN
  SELECT RAISE(ABORT, 'company_responsibility_source_cutover_immutable');
END;

CREATE TRIGGER company_responsibility_source_cutovers_identity_update
BEFORE UPDATE OF id ON company_responsibility_source_cutovers
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

CREATE TRIGGER company_responsibility_source_cutovers_insert_guard
BEFORE INSERT ON company_responsibility_source_cutovers
BEGIN
  SELECT RAISE(ABORT, 'company_responsibility_source_cutover_freeze_invalid')
  WHERE NOT EXISTS (
    SELECT 1 FROM system_record_source_freezes freeze
    WHERE freeze.id = NEW.freeze_id
      AND freeze.source_namespace = NEW.source_namespace
      AND freeze.owner_context = NEW.source_context
      AND freeze.revision = 1
  );

  SELECT RAISE(ABORT, 'company_responsibility_source_cutover_manifest_invalid')
  WHERE EXISTS (
    SELECT 1 FROM json_each(NEW.source_manifest_json) entry
    WHERE json_type(entry.value) <> 'object'
      OR NOT EXISTS (
        SELECT 1 FROM company_responsibility_source_adoptions adoption
        WHERE adoption.organization_id = NEW.organization_id
          AND adoption.source_context = NEW.source_context
          AND adoption.source_kind = NEW.source_kind
          AND adoption.source_namespace = NEW.source_namespace
          AND adoption.freeze_id = NEW.freeze_id
          AND adoption.source_id = json_extract(entry.value, '$.sourceId')
          AND adoption.source_version = json_extract(entry.value, '$.sourceVersion')
      )
  ) OR EXISTS (
    SELECT 1 FROM company_responsibility_source_adoptions adoption
    WHERE adoption.organization_id = NEW.organization_id
      AND adoption.source_context = NEW.source_context
      AND adoption.source_kind = NEW.source_kind
      AND adoption.source_namespace = NEW.source_namespace
      AND adoption.freeze_id = NEW.freeze_id
      AND NOT EXISTS (
        SELECT 1 FROM json_each(NEW.source_manifest_json) entry
        WHERE json_extract(entry.value, '$.sourceId') = adoption.source_id
          AND json_extract(entry.value, '$.sourceVersion') = adoption.source_version
      )
  );
END;

CREATE TRIGGER company_responsibility_source_cutovers_update_guard
BEFORE UPDATE ON company_responsibility_source_cutovers
BEGIN
  SELECT RAISE(ABORT, 'company_responsibility_source_cutover_immutable');
END;

CREATE TRIGGER company_responsibility_source_revision_guard
BEFORE UPDATE OF revision ON company_organizations
WHEN NOT EXISTS (
  SELECT 1 FROM company_workforce_resource_bindings binding
  JOIN company_employee_lifecycle_revisions lifecycle ON lifecycle.employee_id = binding.employee_id
  WHERE binding.organization_id = NEW.id AND binding.resource_type = 'employee' AND binding.lifecycle_revision != lifecycle.revision
)
BEGIN
  SELECT RAISE(ABORT, 'organization responsibility public source is stale')
  WHERE EXISTS (SELECT 1 FROM company_responsibility_source_mismatches WHERE organization_id = NEW.id);
END;

CREATE TRIGGER company_site_legal_entity_guard
BEFORE INSERT ON company_resource_revisions
WHEN NEW.resource_type = 'site' AND NEW.state = 'active'
  AND NOT EXISTS (
    SELECT 1 FROM company_resource_revisions legal_entity
    WHERE legal_entity.organization_id = NEW.organization_id AND legal_entity.resource_type = 'legal-entity'
      AND legal_entity.resource_id = json_extract(NEW.attributes_json, '$.legalEntityId')
      AND legal_entity.state = 'active'
  )
BEGIN
  SELECT RAISE(ABORT, 'company_site_legal_entity_not_found');
END;

CREATE TRIGGER company_workforce_connection_completions_identity_update
BEFORE UPDATE OF id ON company_workforce_connection_completions
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

CREATE TRIGGER company_workforce_connection_completions_no_delete
BEFORE DELETE ON company_workforce_connection_completions
BEGIN SELECT RAISE(ABORT, 'company_workforce_connection_completion_immutable'); END;

CREATE TRIGGER company_workforce_connection_completions_no_update
BEFORE UPDATE ON company_workforce_connection_completions
BEGIN SELECT RAISE(ABORT, 'company_workforce_connection_completion_immutable'); END;

CREATE TRIGGER company_workforce_connection_completions_requires_connection
BEFORE INSERT ON company_workforce_connection_completions
WHEN EXISTS (
  SELECT 1 FROM company_employees AS employee
  WHERE NOT EXISTS (
    SELECT 1 FROM company_workforce_resource_bindings AS binding
    WHERE binding.resource_type = 'employee' AND binding.employee_id = employee.id
  )
) OR EXISTS (
  SELECT 1 FROM company_employments AS employment
  WHERE NOT EXISTS (
    SELECT 1 FROM company_workforce_resource_bindings AS binding
    WHERE binding.resource_type = 'employment' AND binding.resource_id = employment.id
  )
)
BEGIN SELECT RAISE(ABORT, 'company_workforce_connection_incomplete'); END;

CREATE TRIGGER company_workforce_projection_guard
BEFORE UPDATE OF revision ON company_organizations
WHEN NEW.revision != OLD.revision
BEGIN
  SELECT RAISE(ABORT, 'company_workforce_period_conflict')
  WHERE EXISTS (
    WITH latest AS (
      SELECT period.* FROM company_employment_period_versions AS period
      JOIN company_workforce_resource_bindings AS binding
        ON binding.employee_id = period.employee_id AND binding.resource_type = 'employee'
        AND binding.organization_id = NEW.id
      WHERE period.is_void = 0 AND NOT EXISTS (
        SELECT 1 FROM company_employment_period_versions AS newer
        WHERE newer.period_id = period.period_id AND newer.revision > period.revision
      )
    )
    SELECT 1 FROM latest AS left_period JOIN latest AS right_period
      ON left_period.employee_id = right_period.employee_id
      AND left_period.period_id < right_period.period_id
    WHERE (left_period.ends_on IS NULL OR right_period.starts_on < left_period.ends_on)
      AND (right_period.ends_on IS NULL OR left_period.starts_on < right_period.ends_on)
  );

  SELECT RAISE(ABORT, 'company_workforce_reference_period_conflict')
  WHERE EXISTS (
    WITH ranked AS (
      SELECT resource.*,
        row_number() OVER (PARTITION BY resource_type, resource_id, effective_from ORDER BY revision DESC) AS start_rank
      FROM company_resource_revisions AS resource
      WHERE organization_id = NEW.id AND resource_type IN ('person', 'employee')
    ),
    slices AS (
      SELECT resource_type, resource_id, state, attributes_json, effective_from AS starts_on,
        nullif(min(coalesce(effective_to, '9999-12-32'),
          coalesce(lead(effective_from) OVER (PARTITION BY resource_type, resource_id ORDER BY effective_from), '9999-12-32')), '9999-12-32') AS ends_on
      FROM ranked WHERE start_rank = 1
    ),
    reference_intervals AS (
      SELECT 'employee' AS reference_type, period.employee_id AS reference_id,
        period.starts_on, period.ends_on
      FROM company_employment_period_versions AS period
      JOIN company_workforce_resource_bindings AS binding ON binding.resource_type = 'employee'
        AND binding.employee_id = period.employee_id AND binding.organization_id = NEW.id
      WHERE period.is_void = 0 AND NOT EXISTS (
        SELECT 1 FROM company_employment_period_versions AS newer
        WHERE newer.period_id = period.period_id AND newer.revision > period.revision
      )
      UNION ALL
      SELECT 'person', json_extract(employee.attributes_json, '$.personId'),
        employee.starts_on, employee.ends_on
      FROM slices AS employee
      JOIN company_workforce_resource_bindings AS binding ON binding.resource_type = 'employee'
        AND binding.resource_id = employee.resource_id AND binding.organization_id = NEW.id
      WHERE employee.resource_type = 'employee' AND employee.state = 'active'
    ),
    reference_boundaries AS (
      SELECT resource_type, resource_id, starts_on AS boundary_on FROM slices
      UNION SELECT resource_type, resource_id, ends_on FROM slices WHERE ends_on IS NOT NULL
    ),
    reference_points AS (
      SELECT reference_type, reference_id, starts_on AS effective_on FROM reference_intervals
      UNION
      SELECT reference.reference_type, reference.reference_id, boundary.boundary_on
      FROM reference_intervals AS reference JOIN reference_boundaries AS boundary
        ON boundary.resource_type = reference.reference_type AND boundary.resource_id = reference.reference_id
      WHERE reference.starts_on <= boundary.boundary_on
        AND (reference.ends_on IS NULL OR boundary.boundary_on < reference.ends_on)
    )
    SELECT 1 FROM reference_points AS reference
    WHERE NOT EXISTS (
      SELECT 1 FROM slices AS target
      WHERE target.resource_type = reference.reference_type AND target.resource_id = reference.reference_id
        AND target.state = 'active' AND target.starts_on <= reference.effective_on
        AND (target.ends_on IS NULL OR reference.effective_on < target.ends_on)
    )
  );
END;

CREATE TRIGGER company_workforce_resource_bindings_identity_update
BEFORE UPDATE OF id ON company_workforce_resource_bindings
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

CREATE TRIGGER company_workforce_resource_owner_guard
BEFORE INSERT ON company_resource_revisions
WHEN EXISTS (
  SELECT 1 FROM company_resource_heads AS previous
  WHERE previous.organization_id = NEW.organization_id
    AND previous.resource_type = NEW.resource_type
    AND previous.resource_id = NEW.resource_id
    AND (
      (NEW.resource_type = 'employee' AND
       json_extract(previous.attributes_json, '$.personId') IS NOT
       json_extract(NEW.attributes_json, '$.personId'))
      OR (NEW.resource_type = 'employment' AND
          json_extract(previous.attributes_json, '$.employeeId') IS NOT
          json_extract(NEW.attributes_json, '$.employeeId'))
    )
)
BEGIN
  SELECT RAISE(ABORT, 'company_workforce_owner_immutable');
END;

CREATE TRIGGER company_workforce_resource_reference_guard
BEFORE INSERT ON company_resource_revisions
WHEN NEW.state = 'active' AND (
  (NEW.resource_type = 'employee' AND NOT EXISTS (
    SELECT 1 FROM company_resource_heads AS person
    WHERE person.organization_id = NEW.organization_id
      AND person.resource_type = 'person'
      AND person.resource_id = json_extract(NEW.attributes_json, '$.personId')
      AND person.state = 'active'
  ))
  OR (NEW.resource_type IN (
    'employment', 'assignment', 'reporting-relation', 'office-assignment',
    'organizational-authority', 'account-employee-link'
  ) AND NOT EXISTS (
    SELECT 1 FROM company_resource_heads AS employee
    WHERE employee.organization_id = NEW.organization_id
      AND employee.resource_type = 'employee'
      AND employee.resource_id = json_extract(NEW.attributes_json, '$.employeeId')
      AND employee.state = 'active'
  ))
  OR (NEW.resource_type = 'reporting-relation' AND NOT EXISTS (
    SELECT 1 FROM company_resource_heads AS manager
    WHERE manager.organization_id = NEW.organization_id
      AND manager.resource_type = 'employee'
      AND manager.resource_id = json_extract(NEW.attributes_json, '$.managerEmployeeId')
      AND manager.state = 'active'
  ))
  OR (NEW.resource_type IN (
    'assignment', 'office-assignment', 'organizational-authority'
  ) AND NOT EXISTS (
    SELECT 1 FROM company_resource_heads AS employment
    WHERE employment.organization_id = NEW.organization_id
      AND employment.resource_type = 'employment'
      AND employment.resource_id = json_extract(NEW.attributes_json, '$.employmentId')
      AND json_extract(employment.attributes_json, '$.employeeId') =
          json_extract(NEW.attributes_json, '$.employeeId')
      AND employment.state = 'active'
  ))
)
BEGIN
  SELECT RAISE(ABORT, 'company_workforce_reference_not_found');
END;

CREATE TRIGGER company_workforce_resource_void_guard
BEFORE INSERT ON company_resource_revisions
WHEN NEW.state = 'void'
  AND NEW.resource_type IN ('person', 'employee', 'employment')
  AND EXISTS (
    SELECT 1 FROM company_resource_heads AS dependent
    WHERE dependent.organization_id = NEW.organization_id
      AND dependent.state = 'active'
      AND (
        (NEW.resource_type = 'person' AND dependent.resource_type = 'employee'
         AND json_extract(dependent.attributes_json, '$.personId') = NEW.resource_id)
        OR (NEW.resource_type = 'employee' AND (
          (dependent.resource_type IN (
            'employment', 'assignment', 'reporting-relation', 'office-assignment',
            'collective-body-membership', 'organizational-authority', 'account-employee-link'
          ) AND json_extract(dependent.attributes_json, '$.employeeId') = NEW.resource_id)
          OR (dependent.resource_type = 'reporting-relation'
              AND json_extract(dependent.attributes_json, '$.managerEmployeeId') = NEW.resource_id)
          OR (dependent.resource_type = 'responsibility-assignment'
              AND json_extract(dependent.attributes_json, '$.holderType') = 'employee'
              AND json_extract(dependent.attributes_json, '$.holderId') = NEW.resource_id)
        ))
        OR (NEW.resource_type = 'employment' AND dependent.resource_type IN (
          'assignment', 'office-assignment', 'organizational-authority'
        ) AND json_extract(dependent.attributes_json, '$.employmentId') = NEW.resource_id)
      )
  )
BEGIN
  SELECT RAISE(ABORT, 'company_workforce_resource_is_in_use');
END;

CREATE TRIGGER company_workplace_site_guard
BEFORE INSERT ON company_resource_revisions
WHEN NEW.resource_type = 'workplace' AND NEW.state = 'active'
  AND NOT EXISTS (
    SELECT 1 FROM company_resource_revisions site
    WHERE site.organization_id = NEW.organization_id AND site.resource_type = 'site'
      AND site.resource_id = json_extract(NEW.attributes_json, '$.siteId') AND site.state = 'active'
  )
BEGIN
  SELECT RAISE(ABORT, 'company_workplace_site_not_found');
END;

CREATE TRIGGER governance_responsibility_cutover_coverage_guard
BEFORE INSERT ON company_responsibility_source_cutovers
BEGIN
  SELECT RAISE(ABORT, 'company_responsibility_source_cutover_coverage_invalid')
  WHERE NEW.source_context <> 'governance'
    OR NEW.source_kind <> 'org-role-assignment'
    OR NEW.source_count <> (SELECT count(*) FROM governance_org_role_assignments)
    OR NEW.adopted_count <> (
      SELECT count(*) FROM company_responsibility_source_adoptions
      WHERE organization_id = NEW.organization_id
        AND source_context = NEW.source_context
        AND source_kind = NEW.source_kind
        AND source_namespace = NEW.source_namespace
        AND freeze_id = NEW.freeze_id
    )
    OR EXISTS (
      SELECT 1
      FROM governance_org_role_assignments source
      LEFT JOIN company_responsibility_source_adoptions adoption
        ON adoption.organization_id = NEW.organization_id
        AND adoption.source_context = NEW.source_context
        AND adoption.source_kind = NEW.source_kind
        AND adoption.source_namespace = NEW.source_namespace
        AND adoption.freeze_id = NEW.freeze_id
        AND adoption.source_id = CAST(source.id AS TEXT)
      LEFT JOIN company_resource_revisions resource
        ON resource.organization_id = adoption.organization_id
        AND resource.resource_type = adoption.resource_type
        AND resource.resource_id = adoption.resource_id
        AND resource.revision = adoption.resource_revision
      WHERE adoption.source_id IS NULL
        OR adoption.source_version <> adoption.snapshot_digest
        OR json_extract(adoption.source_json, '$.id') IS NOT source.id
        OR json_extract(adoption.source_json, '$.org_role_code') IS NOT source.org_role_code
        OR json_extract(adoption.source_json, '$.employee_id') IS NOT CAST(source.employee_id AS TEXT)
        OR json_extract(adoption.source_json, '$.department_code') IS NOT source.department_code
        OR json_extract(adoption.source_json, '$.starts_on') IS NOT source.starts_on
        OR json_extract(adoption.source_json, '$.ends_on') IS NOT source.ends_on
        OR json_extract(adoption.source_json, '$.source_document_code') IS NOT source.source_document_code
        OR json_extract(adoption.source_json, '$.created_by_account_id') IS NOT source.created_by_account_id
        OR json_extract(adoption.source_json, '$.created_at') IS NOT source.created_at
        OR json_extract(adoption.source_json, '$.revoked_by_account_id') IS NOT source.revoked_by_account_id
        OR json_extract(adoption.source_json, '$.revoked_at') IS NOT source.revoked_at
        OR resource.resource_id IS NULL
    );
END;

CREATE TRIGGER system_accounts_identity_update
BEFORE UPDATE OF id, legacy_id ON system_accounts
WHEN NEW.id IS NOT OLD.id OR NEW.legacy_id IS NOT OLD.legacy_id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

CREATE TRIGGER system_accounts_legacy_id_insert
BEFORE INSERT ON system_accounts
WHEN NEW.legacy_id IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'record_legacy_id_immutable'); END;

CREATE TRIGGER system_accounts_monotonic_security_state
BEFORE UPDATE ON system_accounts
WHEN
  NEW.id IS NOT OLD.id
  OR NEW.created_at IS NOT OLD.created_at
  OR NEW.token_version < OLD.token_version
  OR NEW.updated_at < OLD.updated_at
  OR (
    NEW.status IS NOT OLD.status
    AND NEW.token_version IS NOT OLD.token_version + 1
  )
  OR (
    OLD.closed_at IS NULL
    AND NEW.closed_at IS NOT NULL
    AND (
      NEW.status IS NOT 'suspended'
      OR NEW.token_version IS NOT OLD.token_version + 1
      OR NEW.updated_at IS NOT NEW.closed_at
      OR NEW.closed_at < OLD.updated_at
    )
  )
  OR (
    OLD.closed_at IS NOT NULL
    AND (
      NEW.status IS NOT OLD.status
      OR NEW.token_version IS NOT OLD.token_version
      OR NEW.updated_at IS NOT OLD.updated_at
      OR NEW.closed_at IS NOT OLD.closed_at
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'account security state is not monotonic');
END;

CREATE TRIGGER system_attachment_preservation_content_guard
BEFORE UPDATE ON system_attachments
WHEN NEW.id IS NOT OLD.id OR NEW.owner_account_id IS NOT OLD.owner_account_id
  OR NEW.object_key IS NOT OLD.object_key OR NEW.plaintext_sha256 IS NOT OLD.plaintext_sha256
  OR NEW.content_type IS NOT OLD.content_type OR NEW.byte_size IS NOT OLD.byte_size
  OR NEW.file_name IS NOT OLD.file_name OR NEW.content_iv IS NOT OLD.content_iv OR NEW.created_at IS NOT OLD.created_at
  OR (NEW.status <> 'erased' AND (NEW.wrapped_dek IS NOT OLD.wrapped_dek OR NEW.wrapped_dek_iv IS NOT OLD.wrapped_dek_iv OR NEW.kek_version IS NOT OLD.kek_version))
BEGIN
  SELECT RAISE(ABORT, 'attachment_preserved_content_immutable')
  WHERE EXISTS (SELECT 1 FROM system_attachment_preservations WHERE attachment_id = OLD.id);
END;

CREATE TRIGGER system_attachment_preservation_delete_guard
BEFORE DELETE ON system_attachments
BEGIN
  SELECT RAISE(ABORT, 'attachment_preserved')
  WHERE EXISTS (
    SELECT 1 FROM system_attachment_preservations WHERE attachment_id = OLD.id
      AND ((kind = 'hold' AND released_at IS NULL)
        OR (kind = 'retention' AND (OLD.status <> 'erased' OR OLD.erased_at IS NULL OR retain_until > OLD.erased_at)))
  );
END;

CREATE TRIGGER system_attachment_preservation_erase_guard
BEFORE UPDATE ON system_attachments
WHEN NEW.status = 'erased' OR NEW.wrapped_dek IS NULL
BEGIN
  SELECT RAISE(ABORT, 'attachment_preserved')
  WHERE EXISTS (
    SELECT 1 FROM system_attachment_preservations WHERE attachment_id = OLD.id
      AND ((kind = 'hold' AND released_at IS NULL)
        OR (kind = 'retention' AND (NEW.erased_at IS NULL OR retain_until > NEW.erased_at)))
  );
END;

CREATE TRIGGER system_attachment_preservation_identity_guard
BEFORE INSERT ON system_attachments
WHEN EXISTS (SELECT 1 FROM system_attachment_preservations WHERE attachment_id = NEW.id)
BEGIN
  SELECT RAISE(ABORT, 'attachment_preserved_identity_immutable');
END;

CREATE TRIGGER system_attachment_preservations_delete
BEFORE DELETE ON system_attachment_preservations
BEGIN
  SELECT RAISE(ABORT, 'attachment_preservation_immutable');
END;

CREATE TRIGGER system_attachment_preservations_insert
BEFORE INSERT ON system_attachment_preservations
BEGIN
  SELECT RAISE(ABORT, 'attachment_preservation_target_unavailable')
  WHERE NEW.revision <> 1 OR NOT EXISTS (
    SELECT 1 FROM system_attachments WHERE id = NEW.attachment_id AND status IN ('uploading', 'pending', 'linked')
      AND wrapped_dek IS NOT NULL AND plaintext_sha256 = NEW.plaintext_sha256 AND created_at <= NEW.created_at
  );
  SELECT RAISE(ABORT, 'attachment_preservation_audit_missing')
  WHERE NOT EXISTS (
    SELECT 1 FROM system_audit_events WHERE event_id = NEW.created_audit_event_id
      AND actor_account_id = NEW.created_by_account_id AND action = 'system.attachment.preservation.created'
      AND target_type = 'system:attachment-preservation' AND target_id = NEW.id AND outcome = 'succeeded'
      AND occurred_at = NEW.created_at AND before_json IS NULL
      AND json_extract(after_json, '$.id') = NEW.id AND json_extract(after_json, '$.attachmentId') = NEW.attachment_id
      AND json_extract(after_json, '$.sha256') = NEW.plaintext_sha256 AND json_extract(after_json, '$.kind') = NEW.kind
      AND json_extract(after_json, '$.reason') = NEW.reason AND json_extract(after_json, '$.revision') = 1
      AND json_extract(after_json, '$.retainUntil') IS strftime('%Y-%m-%dT%H:%M:%fZ', NEW.retain_until / 1000.0, 'unixepoch')
      AND json_extract(after_json, '$.actorAccountId') = NEW.created_by_account_id
      AND json_extract(after_json, '$.createdAt') = strftime('%Y-%m-%dT%H:%M:%fZ', NEW.created_at / 1000.0, 'unixepoch')
      AND json_extract(after_json, '$.auditEventId') = NEW.created_audit_event_id
      AND json_type(after_json, '$.release') = 'null'
  );
END;

CREATE TRIGGER system_attachment_preservations_update
BEFORE UPDATE ON system_attachment_preservations
BEGIN
  SELECT RAISE(ABORT, 'attachment_preservation_immutable')
  WHERE OLD.revision <> 1 OR NEW.revision <> 2 OR OLD.kind <> 'hold'
    OR NEW.id IS NOT OLD.id OR NEW.attachment_id IS NOT OLD.attachment_id OR NEW.plaintext_sha256 IS NOT OLD.plaintext_sha256
    OR NEW.kind IS NOT OLD.kind OR NEW.retain_until IS NOT OLD.retain_until OR NEW.reason IS NOT OLD.reason
    OR NEW.created_by_account_id IS NOT OLD.created_by_account_id OR NEW.created_at IS NOT OLD.created_at
    OR NEW.created_audit_event_id IS NOT OLD.created_audit_event_id;
  SELECT RAISE(ABORT, 'attachment_preservation_audit_missing')
  WHERE NOT EXISTS (
    SELECT 1 FROM system_audit_events WHERE event_id = NEW.release_audit_event_id
      AND actor_account_id = NEW.released_by_account_id AND action = 'system.attachment.preservation.released'
      AND target_type = 'system:attachment-preservation' AND target_id = NEW.id AND outcome = 'succeeded'
      AND occurred_at = NEW.released_at AND json_extract(before_json, '$.revision') = 1
      AND json_extract(after_json, '$.id') = NEW.id AND json_extract(after_json, '$.revision') = 2
      AND json_extract(after_json, '$.release.operationId') = NEW.release_operation_id
      AND json_extract(after_json, '$.release.reason') = NEW.release_reason
      AND json_extract(after_json, '$.attachmentId') = NEW.attachment_id
      AND json_extract(after_json, '$.sha256') = NEW.plaintext_sha256
      AND json_extract(after_json, '$.kind') = NEW.kind
      AND json_extract(after_json, '$.retainUntil') IS NULL
      AND json_extract(after_json, '$.reason') = NEW.reason
      AND json_extract(after_json, '$.actorAccountId') = NEW.created_by_account_id
      AND json_extract(after_json, '$.createdAt') = strftime('%Y-%m-%dT%H:%M:%fZ', NEW.created_at / 1000.0, 'unixepoch')
      AND json_extract(after_json, '$.auditEventId') = NEW.created_audit_event_id
      AND json_extract(after_json, '$.release.actorAccountId') = NEW.released_by_account_id
      AND json_extract(after_json, '$.release.at') = strftime('%Y-%m-%dT%H:%M:%fZ', NEW.released_at / 1000.0, 'unixepoch')
      AND json_extract(after_json, '$.release.auditEventId') = NEW.release_audit_event_id
      AND json_extract(before_json, '$.id') = OLD.id
      AND json_extract(before_json, '$.attachmentId') = OLD.attachment_id
      AND json_extract(before_json, '$.sha256') = OLD.plaintext_sha256
      AND json_extract(before_json, '$.kind') = OLD.kind
      AND json_type(before_json, '$.retainUntil') = 'null'
      AND json_extract(before_json, '$.reason') = OLD.reason
      AND json_extract(before_json, '$.actorAccountId') = OLD.created_by_account_id
      AND json_extract(before_json, '$.createdAt') = strftime('%Y-%m-%dT%H:%M:%fZ', OLD.created_at / 1000.0, 'unixepoch')
      AND json_extract(before_json, '$.auditEventId') = OLD.created_audit_event_id
      AND json_type(before_json, '$.release') = 'null'
  );
END;

CREATE TRIGGER system_attachments_retirement_frozen_delete BEFORE DELETE ON system_attachments
BEGIN
  SELECT RAISE(ABORT,'record_retirement_source_attachment_frozen') WHERE EXISTS (
    SELECT 1 FROM system_record_retirement_attachment_pins pin
    JOIN system_record_retirement_receipts receipt ON receipt.id=pin.receipt_id
    JOIN system_record_retirement_plans plan ON plan.id=receipt.plan_id
    JOIN system_record_source_freezes freeze ON freeze.id=plan.freeze_id AND freeze.revision=1
    JOIN system_attachments attachment ON attachment.id=pin.attachment_id
    WHERE attachment.id=OLD.id
  );
END;

CREATE TRIGGER system_attachments_retirement_frozen_insert BEFORE INSERT ON system_attachments
BEGIN
  SELECT RAISE(ABORT,'record_retirement_source_attachment_frozen') WHERE EXISTS (
    SELECT 1 FROM system_record_retirement_attachment_pins pin
    JOIN system_record_retirement_receipts receipt ON receipt.id=pin.receipt_id
    JOIN system_record_retirement_plans plan ON plan.id=receipt.plan_id
    JOIN system_record_source_freezes freeze ON freeze.id=plan.freeze_id AND freeze.revision=1
    JOIN system_attachments attachment ON attachment.id=pin.attachment_id
    WHERE attachment.id=NEW.id OR attachment.object_key=NEW.object_key
  );
END;

CREATE TRIGGER system_attachments_retirement_frozen_update BEFORE UPDATE ON system_attachments
BEGIN
  SELECT RAISE(ABORT,'record_retirement_source_attachment_frozen') WHERE EXISTS (
    SELECT 1 FROM system_record_retirement_attachment_pins pin
    JOIN system_record_retirement_receipts receipt ON receipt.id=pin.receipt_id
    JOIN system_record_retirement_plans plan ON plan.id=receipt.plan_id
    JOIN system_record_source_freezes freeze ON freeze.id=plan.freeze_id AND freeze.revision=1
    JOIN system_attachments attachment ON attachment.id=pin.attachment_id
    WHERE attachment.id=OLD.id OR attachment.id=NEW.id OR attachment.object_key=NEW.object_key
  );
END;

CREATE TRIGGER system_attestation_requires_human
BEFORE INSERT ON system_human_attestations
WHEN NOT EXISTS (
  SELECT 1 FROM system_accounts account
  JOIN system_principals principal ON principal.account_id = account.id
  WHERE account.id = NEW.actor_account_id AND account.status = 'active' AND account.closed_at IS NULL
    AND account.created_at <= NEW.decided_at AND principal.kind = 'human' AND principal.created_at <= NEW.decided_at
) OR NOT EXISTS (
  SELECT 1 FROM system_accounts account
  JOIN system_principals principal ON principal.account_id = account.id
  WHERE account.id = NEW.represented_account_id AND account.status = 'active' AND account.closed_at IS NULL
    AND account.created_at <= NEW.decided_at AND principal.kind = 'human' AND principal.created_at <= NEW.decided_at
)
BEGIN
  SELECT RAISE(ABORT, 'system_attestation_requires_human');
END;

CREATE TRIGGER system_audit_disclosure_revision_delete
BEFORE DELETE ON system_audit_disclosure_policy_revisions
BEGIN
  SELECT RAISE(ABORT, 'audit disclosure revisions are immutable');
END;

CREATE TRIGGER system_audit_disclosure_revision_insert
BEFORE INSERT ON system_audit_disclosure_policy_revisions
BEGIN
  SELECT RAISE(ABORT, 'audit_disclosure_revision_conflict')
  WHERE NEW.revision <> 1 + COALESCE((SELECT MAX(revision) FROM system_audit_disclosure_policy_revisions WHERE scope = NEW.scope), 0)
    OR NEW.recorded_at < COALESCE((SELECT MAX(recorded_at) FROM system_audit_disclosure_policy_revisions WHERE scope = NEW.scope), 0);
  SELECT RAISE(ABORT, 'audit_disclosure_scope_unavailable')
  WHERE NEW.scope <> '*' AND NOT EXISTS (SELECT 1 FROM system_accounts WHERE id = NEW.scope);
  SELECT RAISE(ABORT, 'audit_disclosure_fields_invalid')
  WHERE json_array_length(NEW.allowed_fields_json) > 7
    OR EXISTS (SELECT 1 FROM json_each(NEW.allowed_fields_json) WHERE type <> 'text' OR value NOT IN ('actor_account_id', 'target_id', 'reason_code', 'authorization_json', 'before_json', 'after_json', 'metadata_json'))
    OR (SELECT COUNT(*) FROM json_each(NEW.allowed_fields_json)) <> (SELECT COUNT(DISTINCT value) FROM json_each(NEW.allowed_fields_json));
  SELECT RAISE(ABORT, 'audit_disclosure_labels_invalid')
  WHERE json_array_length(NEW.allowed_target_types_json) > 64 OR json_array_length(NEW.allowed_purposes_json) > 64
    OR EXISTS (SELECT 1 FROM json_each(NEW.allowed_target_types_json) WHERE type <> 'text' OR length(trim(value)) NOT BETWEEN 1 AND 100)
    OR EXISTS (SELECT 1 FROM json_each(NEW.allowed_purposes_json) WHERE type <> 'text' OR length(trim(value)) NOT BETWEEN 1 AND 100);
  SELECT RAISE(ABORT, 'audit_disclosure_audit_mismatch')
  WHERE NOT EXISTS (
    SELECT 1 FROM system_audit_events audit
    WHERE audit.event_id = NEW.audit_event_id AND audit.actor_account_id = NEW.actor_account_id
      AND audit.action = 'system.audit.disclosure.published' AND audit.target_type = 'system:audit-disclosure-policy'
      AND audit.target_id = NEW.scope AND audit.outcome = 'succeeded' AND audit.occurred_at = NEW.recorded_at
      AND json_extract(audit.after_json, '$.scope') IS NEW.scope
      AND json_extract(audit.after_json, '$.revision') IS NEW.revision
      AND json_extract(audit.after_json, '$.commandId') IS NEW.command_id
      AND json_extract(audit.after_json, '$.enabled') IS NEW.enabled
      AND json_extract(audit.after_json, '$.allowedFields') IS NEW.allowed_fields_json
      AND json_extract(audit.after_json, '$.allowedTargetTypes') IS NEW.allowed_target_types_json
      AND json_extract(audit.after_json, '$.allowedPurposes') IS NEW.allowed_purposes_json
      AND json_extract(audit.after_json, '$.expiresAt') IS strftime('%Y-%m-%dT%H:%M:%fZ', NEW.expires_at / 1000.0, 'unixepoch')
      AND json_extract(audit.after_json, '$.reason') IS NEW.reason
      AND json_extract(audit.after_json, '$.actorAccountId') IS NEW.actor_account_id
      AND json_extract(audit.after_json, '$.recordedAt') IS strftime('%Y-%m-%dT%H:%M:%fZ', NEW.recorded_at / 1000.0, 'unixepoch')
      AND json_extract(audit.after_json, '$.auditEventId') IS NEW.audit_event_id
      AND ((NEW.revision = 1 AND audit.before_json IS NULL) OR (NEW.revision > 1 AND audit.before_json = (
        SELECT previous_audit.after_json FROM system_audit_disclosure_policy_revisions previous
        JOIN system_audit_events previous_audit ON previous_audit.event_id = previous.audit_event_id
        WHERE previous.scope = NEW.scope AND previous.revision = NEW.revision - 1
      )))
  );
END;

CREATE TRIGGER system_audit_disclosure_revision_update
BEFORE UPDATE ON system_audit_disclosure_policy_revisions
BEGIN
  SELECT RAISE(ABORT, 'audit disclosure revisions are immutable');
END;

CREATE TRIGGER system_audit_events_prevent_delete
BEFORE DELETE ON system_audit_events
BEGIN
  SELECT RAISE(ABORT, 'system audit event is append-only');
END;

CREATE TRIGGER system_audit_events_prevent_update
BEFORE UPDATE ON system_audit_events
BEGIN
  SELECT RAISE(ABORT, 'system audit event is append-only');
END;

CREATE TRIGGER system_batch_jobs_identity_update
BEFORE UPDATE OF id, legacy_id ON system_batch_jobs
WHEN NEW.id IS NOT OLD.id OR NEW.legacy_id IS NOT OLD.legacy_id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

CREATE TRIGGER system_batch_jobs_legacy_id_insert
BEFORE INSERT ON system_batch_jobs
WHEN NEW.legacy_id IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'record_legacy_id_immutable'); END;

CREATE TRIGGER system_bootstrap_state_prevent_delete
BEFORE DELETE ON system_bootstrap_state
BEGIN
  SELECT RAISE(ABORT, 'bootstrap state is immutable');
END;

CREATE TRIGGER system_bootstrap_state_prevent_update
BEFORE UPDATE ON system_bootstrap_state
BEGIN
  SELECT RAISE(ABORT, 'bootstrap state is immutable');
END;

CREATE TRIGGER system_bootstrap_state_validate_root
BEFORE INSERT ON system_bootstrap_state
WHEN NOT EXISTS (
  SELECT 1
  FROM system_role_bindings binding
  INNER JOIN system_accounts account
    ON account.id = binding.account_id
  INNER JOIN system_iam_role_permissions permission
    ON permission.role_id = binding.role_id
  WHERE binding.id = NEW.root_binding_id
    AND binding.account_id = NEW.completed_by_account_id
    AND binding.resource_type IS NULL
    AND binding.resource_id IS NULL
    AND binding.revoked_at IS NULL
    AND account.status = 'active'
    AND permission.permission_key = 'system:admin'
)
BEGIN
  SELECT RAISE(ABORT, 'bootstrap requires an active global System root binding');
END;

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

CREATE TRIGGER system_cases_cancelled_tasks
BEFORE UPDATE OF status ON system_cases
WHEN NEW.status = 'cancelled' AND EXISTS (
  SELECT 1 FROM system_decision_tasks
  WHERE case_id = NEW.id AND outcome IS NULL
)
BEGIN
  SELECT RAISE(ABORT, 'system case cancellation requires closed tasks');
END;

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

CREATE TRIGGER system_cases_prevent_delete
BEFORE DELETE ON system_cases
BEGIN
  SELECT RAISE(ABORT, 'system case is immutable');
END;

CREATE TRIGGER system_connectors_revision_step
BEFORE UPDATE ON system_connectors
WHEN NEW.revision <> OLD.revision + 1 OR NEW.updated_at < OLD.updated_at
BEGIN
  SELECT RAISE(ABORT, 'system_connector_revision_conflict');
END;

CREATE TRIGGER system_dead_letters_monotonic_update
BEFORE UPDATE ON system_dead_letters
WHEN NEW.id <> OLD.id OR NEW.source_type <> OLD.source_type OR NEW.source_id <> OLD.source_id
  OR NEW.payload_digest <> OLD.payload_digest OR NEW.reason_code <> OLD.reason_code
  OR NEW.attempt <> OLD.attempt OR NEW.recorded_at <> OLD.recorded_at
  OR OLD.requeued_at IS NOT NULL OR NEW.requeued_at IS NULL OR NEW.requeued_job_id IS NULL
BEGIN
  SELECT RAISE(ABORT, 'system_dead_letter_update_invalid');
END;

CREATE TRIGGER system_dead_letters_no_delete BEFORE DELETE ON system_dead_letters
BEGIN SELECT RAISE(ABORT, 'system_dead_letters_are_retained'); END;

CREATE TRIGGER system_dead_letters_source_guard
BEFORE INSERT ON system_dead_letters
WHEN (NEW.source_type = 'job' AND NOT EXISTS (
    SELECT 1 FROM system_jobs WHERE id = NEW.source_id AND status = 'dead_letter'
  )) OR (NEW.source_type = 'outbox' AND NOT EXISTS (
    SELECT 1 FROM system_outbox_messages WHERE id = NEW.source_id AND status = 'dead_letter'
  )) OR (NEW.source_type = 'inbox' AND NOT EXISTS (
    SELECT 1 FROM system_inbox_messages WHERE id = NEW.source_id AND status = 'rejected'
  ))
BEGIN
  SELECT RAISE(ABORT, 'system_dead_letter_source_invalid');
END;

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

CREATE TRIGGER system_decision_task_candidates_identity_update
BEFORE UPDATE OF id ON system_decision_task_candidates
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

CREATE TRIGGER system_decision_task_candidates_prevent_delete
BEFORE DELETE ON system_decision_task_candidates
BEGIN
  SELECT RAISE(ABORT, 'decision task candidate is immutable');
END;

CREATE TRIGGER system_decision_task_candidates_prevent_update
BEFORE UPDATE ON system_decision_task_candidates
BEGIN
  SELECT RAISE(ABORT, 'decision task candidate is immutable');
END;

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

CREATE TRIGGER system_decision_task_exclusions_identity_update
BEFORE UPDATE OF id ON system_decision_task_exclusions
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

CREATE TRIGGER system_decision_task_exclusions_prevent_delete
BEFORE DELETE ON system_decision_task_exclusions
BEGIN
  SELECT RAISE(ABORT, 'decision task exclusion is immutable');
END;

CREATE TRIGGER system_decision_task_exclusions_prevent_update
BEFORE UPDATE ON system_decision_task_exclusions
BEGIN
  SELECT RAISE(ABORT, 'decision task exclusion is immutable');
END;

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

CREATE TRIGGER system_decision_tasks_identity_update
BEFORE UPDATE OF id ON system_decision_tasks
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

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

CREATE TRIGGER system_decision_tasks_prevent_delete
BEFORE DELETE ON system_decision_tasks
BEGIN
  SELECT RAISE(ABORT, 'decision task is immutable');
END;

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

CREATE TRIGGER system_delegation_numbers_prevent_delete
BEFORE DELETE ON system_delegation_numbers
BEGIN
  SELECT RAISE(ABORT, 'delegation number is immutable');
END;

CREATE TRIGGER system_delegation_numbers_prevent_update
BEFORE UPDATE ON system_delegation_numbers
BEGIN
  SELECT RAISE(ABORT, 'delegation number is immutable');
END;

CREATE TRIGGER system_delegation_procedure_scopes_prevent_delete
BEFORE DELETE ON system_delegation_procedure_scopes
BEGIN
  SELECT RAISE(ABORT, 'delegation procedure scope is immutable');
END;

CREATE TRIGGER system_delegation_procedure_scopes_prevent_update
BEFORE UPDATE ON system_delegation_procedure_scopes
BEGIN
  SELECT RAISE(ABORT, 'delegation procedure scope is immutable');
END;

CREATE TRIGGER system_delegation_procedure_scopes_valid_insert
BEFORE INSERT ON system_delegation_procedure_scopes
WHEN NOT EXISTS (
  SELECT 1 FROM system_delegations
  WHERE id = NEW.delegation_id
    AND scope_context IS NULL
    AND scope_kind IS NULL
    AND scope_id IS NULL
    AND scope_version IS NULL
)
BEGIN
  SELECT RAISE(ABORT, 'procedure scope requires an otherwise global delegation');
END;

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

CREATE TRIGGER system_delegations_prevent_delete
BEFORE DELETE ON system_delegations
BEGIN
  SELECT RAISE(ABORT, 'delegation is immutable');
END;

CREATE TRIGGER system_execution_authorizations_prevent_delete
BEFORE DELETE ON system_execution_authorizations
BEGIN
  SELECT RAISE(ABORT, 'execution authorization is immutable');
END;

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

CREATE TRIGGER system_external_assertions_no_delete
BEFORE DELETE ON system_external_assertions
BEGIN
  SELECT RAISE(ABORT, 'system_external_assertions_are_immutable');
END;

CREATE TRIGGER system_external_assertions_no_update
BEFORE UPDATE ON system_external_assertions
BEGIN
  SELECT RAISE(ABORT, 'system_external_assertions_are_immutable');
END;

CREATE TRIGGER system_human_attestations_prevent_delete
BEFORE DELETE ON system_human_attestations
BEGIN
  SELECT RAISE(ABORT, 'human attestation is immutable');
END;

CREATE TRIGGER system_human_attestations_prevent_update
BEFORE UPDATE ON system_human_attestations
BEGIN
  SELECT RAISE(ABORT, 'human attestation is immutable');
END;

CREATE TRIGGER system_human_attestations_procedure_delegation
BEFORE INSERT ON system_human_attestations
WHEN NEW.delegation_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM system_delegation_procedure_scopes
    WHERE delegation_id = NEW.delegation_id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM system_delegation_procedure_scopes AS procedure_scope
    JOIN system_proposal_cases AS proposal_case ON proposal_case.case_id = NEW.case_id
    JOIN system_proposals AS proposal ON proposal.id = proposal_case.proposal_id
    WHERE procedure_scope.delegation_id = NEW.delegation_id
      AND procedure_scope.procedure_key = proposal.procedure_key
  )
BEGIN
  SELECT RAISE(ABORT, 'delegation does not cover this procedure');
END;

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

CREATE TRIGGER system_iam_role_permissions_identity_update
BEFORE UPDATE OF id ON system_iam_role_permissions
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

CREATE TRIGGER system_iam_roles_identity_update
BEFORE UPDATE OF id, legacy_id ON system_iam_roles
WHEN NEW.id IS NOT OLD.id OR NEW.legacy_id IS NOT OLD.legacy_id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

CREATE TRIGGER system_iam_roles_immutable_identity
BEFORE UPDATE OF id, key, kind, resource_type, created_at ON system_iam_roles
BEGIN
  SELECT RAISE(ABORT, 'IAM role identity is immutable');
END;

CREATE TRIGGER system_iam_roles_legacy_id_insert
BEFORE INSERT ON system_iam_roles
WHEN NEW.legacy_id IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'record_legacy_id_immutable'); END;

CREATE TRIGGER system_identity_bindings_closed_account_guard
BEFORE INSERT ON system_identity_bindings
WHEN EXISTS (
  SELECT 1 FROM system_accounts
  WHERE id = NEW.account_id AND closed_at IS NOT NULL
)
BEGIN
  SELECT RAISE(ABORT, 'closed account cannot receive an identity');
END;

CREATE TRIGGER system_identity_bindings_immutable_identity
BEFORE UPDATE OF account_id, provider, subject, created_at ON system_identity_bindings
BEGIN
  SELECT RAISE(ABORT, 'identity binding identity is immutable');
END;

CREATE TRIGGER system_identity_bindings_monotonic_lifecycle
BEFORE UPDATE ON system_identity_bindings
WHEN
  (OLD.activated_at IS NOT NULL AND NEW.activated_at IS NOT OLD.activated_at)
  OR (OLD.revoked_at IS NOT NULL AND NEW.revoked_at IS NOT OLD.revoked_at)
BEGIN
  SELECT RAISE(ABORT, 'identity lifecycle is not monotonic');
END;

CREATE TRIGGER system_inbox_messages_monotonic_update
BEFORE UPDATE ON system_inbox_messages
WHEN NEW.id <> OLD.id OR NEW.source_key <> OLD.source_key
  OR NEW.external_message_id <> OLD.external_message_id OR NEW.payload_digest <> OLD.payload_digest
  OR NEW.received_at <> OLD.received_at OR OLD.status <> 'accepted'
  OR NEW.status = 'accepted'
BEGIN
  SELECT RAISE(ABORT, 'system_inbox_update_invalid');
END;

CREATE TRIGGER system_inbox_messages_no_delete BEFORE DELETE ON system_inbox_messages
BEGIN SELECT RAISE(ABORT, 'system_inbox_messages_are_retained'); END;

CREATE TRIGGER system_jobs_handler_immutable
BEFORE UPDATE ON system_jobs
WHEN NEW.handler_key IS NOT OLD.handler_key
BEGIN
  SELECT RAISE(ABORT, 'system_delivery_handler_immutable');
END;

CREATE TRIGGER system_jobs_monotonic_update
BEFORE UPDATE ON system_jobs
WHEN NEW.id <> OLD.id OR NEW.operation_key <> OLD.operation_key
  OR NEW.payload_digest <> OLD.payload_digest OR NEW.idempotency_key <> OLD.idempotency_key
  OR NEW.created_by_account_id <> OLD.created_by_account_id OR NEW.created_at <> OLD.created_at
  OR NEW.max_attempts <> OLD.max_attempts OR NEW.attempt < OLD.attempt OR NEW.attempt > OLD.attempt + 1
  OR NEW.updated_at < OLD.updated_at OR OLD.status IN ('succeeded', 'dead_letter')
  OR (OLD.status = 'queued' AND NEW.status NOT IN ('queued', 'leased'))
BEGIN
  SELECT RAISE(ABORT, 'system_job_update_invalid');
END;

CREATE TRIGGER system_jobs_no_delete BEFORE DELETE ON system_jobs
BEGIN SELECT RAISE(ABORT, 'system_jobs_are_retained'); END;

CREATE TRIGGER system_machine_credentials_monotonic_update
BEFORE UPDATE ON system_machine_credentials
WHEN NEW.principal_id <> OLD.principal_id
  OR NEW.secret_hash <> OLD.secret_hash
  OR NEW.created_at <> OLD.created_at
  OR NEW.updated_at < OLD.updated_at
  OR (OLD.status = 'revoked' AND NEW.status <> 'revoked')
  OR (OLD.last_used_at IS NOT NULL AND (NEW.last_used_at IS NULL OR NEW.last_used_at < OLD.last_used_at))
BEGIN
  SELECT RAISE(ABORT, 'system_machine_credential_update_invalid');
END;

CREATE TRIGGER system_machine_credentials_no_delete
BEFORE DELETE ON system_machine_credentials
BEGIN
  SELECT RAISE(ABORT, 'system_machine_credentials_are_retained');
END;

CREATE TRIGGER system_machine_credentials_principal_guard
BEFORE INSERT ON system_machine_credentials
WHEN NOT EXISTS (
  SELECT 1 FROM system_principals AS principal
  INNER JOIN system_accounts AS account ON account.id = principal.account_id
  WHERE principal.id = NEW.principal_id
    AND principal.kind IN ('agent', 'service', 'connector')
    AND account.status = 'active'
)
BEGIN
  SELECT RAISE(ABORT, 'system_machine_credential_principal_invalid');
END;

CREATE TRIGGER system_notification_deliveries_monotonic_read
BEFORE UPDATE ON system_notification_deliveries
WHEN
  NEW.id IS NOT OLD.id
  OR NEW.message_id IS NOT OLD.message_id
  OR NEW.recipient_account_id IS NOT OLD.recipient_account_id
  OR NEW.delivered_at IS NOT OLD.delivered_at
  OR (OLD.read_at IS NOT NULL AND NEW.read_at IS NOT OLD.read_at)
  OR (OLD.dismissed_at IS NOT NULL AND NEW.dismissed_at IS NOT OLD.dismissed_at)
  OR (OLD.dismissed_at IS NOT NULL AND NEW.read_at IS NOT OLD.read_at)
BEGIN
  SELECT RAISE(ABORT, 'notification delivery is immutable except first read and dismiss');
END;

CREATE TRIGGER system_notification_messages_action_pair_guard
BEFORE INSERT ON system_notification_messages
WHEN (NEW.action_type IS NULL) != (NEW.action_id IS NULL)
BEGIN
  SELECT RAISE(ABORT, 'notification action reference is incomplete');
END;

CREATE TRIGGER system_notification_messages_prevent_delete
BEFORE DELETE ON system_notification_messages
BEGIN
  SELECT RAISE(ABORT, 'notification message is immutable');
END;

CREATE TRIGGER system_notification_messages_prevent_update
BEFORE UPDATE ON system_notification_messages
BEGIN
  SELECT RAISE(ABORT, 'notification message is immutable');
END;

CREATE TRIGGER system_operation_receipts_identity_update
BEFORE UPDATE OF id ON system_operation_receipts
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

CREATE TRIGGER system_operation_receipts_no_delete BEFORE DELETE ON system_operation_receipts
BEGIN SELECT RAISE(ABORT, 'system operation receipt is immutable'); END;

CREATE TRIGGER system_operation_receipts_no_update BEFORE UPDATE ON system_operation_receipts
BEGIN SELECT RAISE(ABORT, 'system operation receipt is immutable'); END;

CREATE TRIGGER system_outbox_handler_immutable
BEFORE UPDATE ON system_outbox_messages
WHEN NEW.handler_key IS NOT OLD.handler_key
BEGIN
  SELECT RAISE(ABORT, 'system_delivery_handler_immutable');
END;

CREATE TRIGGER system_outbox_messages_monotonic_update
BEFORE UPDATE ON system_outbox_messages
WHEN NEW.id <> OLD.id OR NEW.topic <> OLD.topic OR NEW.source_context <> OLD.source_context
  OR NEW.source_kind <> OLD.source_kind OR NEW.source_id <> OLD.source_id
  OR NEW.source_version <> OLD.source_version OR NEW.payload_digest <> OLD.payload_digest
  OR NEW.idempotency_key <> OLD.idempotency_key
  OR NEW.created_by_account_id <> OLD.created_by_account_id OR NEW.created_at <> OLD.created_at
  OR NEW.max_attempts <> OLD.max_attempts OR NEW.attempt < OLD.attempt OR NEW.attempt > OLD.attempt + 1
  OR NEW.updated_at < OLD.updated_at OR OLD.status IN ('succeeded', 'dead_letter')
  OR (OLD.status = 'queued' AND NEW.status NOT IN ('queued', 'leased'))
BEGIN
  SELECT RAISE(ABORT, 'system_outbox_update_invalid');
END;

CREATE TRIGGER system_outbox_messages_no_delete BEFORE DELETE ON system_outbox_messages
BEGIN SELECT RAISE(ABORT, 'system_outbox_messages_are_retained'); END;

CREATE TRIGGER system_password_credentials_monotonic_change
BEFORE UPDATE ON system_password_credentials
WHEN
  NEW.identity_id IS NOT OLD.identity_id
  OR NEW.created_at IS NOT OLD.created_at
  OR NEW.changed_at < OLD.changed_at
  OR NEW.updated_at < OLD.updated_at
BEGIN
  SELECT RAISE(ABORT, 'password credential change is not monotonic');
END;

CREATE TRIGGER system_password_credentials_provider_insert
BEFORE INSERT ON system_password_credentials
WHEN NOT EXISTS (
  SELECT 1 FROM system_identity_bindings
  WHERE id = NEW.identity_id AND provider = 'password'
)
BEGIN
  SELECT RAISE(ABORT, 'password credential requires password identity');
END;

CREATE TRIGGER system_password_credentials_provider_update
BEFORE UPDATE OF identity_id ON system_password_credentials
WHEN NOT EXISTS (
  SELECT 1 FROM system_identity_bindings
  WHERE id = NEW.identity_id AND provider = 'password'
)
BEGIN
  SELECT RAISE(ABORT, 'password credential requires password identity');
END;

CREATE TRIGGER system_password_reset_challenges_monotonic_use
BEFORE UPDATE ON system_password_reset_challenges
WHEN
  NEW.id IS NOT OLD.id
  OR NEW.token_hash IS NOT OLD.token_hash
  OR NEW.account_id IS NOT OLD.account_id
  OR NEW.identity_id IS NOT OLD.identity_id
  OR NEW.created_at IS NOT OLD.created_at
  OR NEW.expires_at IS NOT OLD.expires_at
  OR (OLD.used_at IS NOT NULL AND NEW.used_at IS NOT OLD.used_at)
BEGIN
  SELECT RAISE(ABORT, 'password reset challenge lifecycle is not monotonic');
END;

CREATE TRIGGER system_password_reset_challenges_password_identity_insert
BEFORE INSERT ON system_password_reset_challenges
WHEN NOT EXISTS (
  SELECT 1 FROM system_identity_bindings
  WHERE id = NEW.identity_id
    AND account_id = NEW.account_id
    AND provider = 'password'
    AND revoked_at IS NULL
)
BEGIN
  SELECT RAISE(ABORT, 'password reset challenge requires a password identity');
END;

CREATE TRIGGER system_preserved_record_insert_guard
BEFORE INSERT ON system_preserved_records
WHEN NOT EXISTS (
  SELECT 1 FROM system_attachments a JOIN system_attachment_preservations h ON h.attachment_id = a.id
  WHERE a.id = NEW.attachment_id AND h.id = NEW.preservation_id
    AND a.status = 'linked' AND a.content_type IN ('application/vnd.record-preservation+json', 'application/vnd.record-preservation+binary')
    AND a.plaintext_sha256 = json_extract(NEW.snapshot_json, '$.attachmentDigest')
    AND h.plaintext_sha256 = a.plaintext_sha256 AND h.released_at IS NULL
    AND h.created_by_account_id = json_extract(NEW.snapshot_json, '$.actorAccountId')
    AND strftime('%Y-%m-%dT%H:%M:%fZ', h.created_at / 1000.0, 'unixepoch') = json_extract(NEW.snapshot_json, '$.finalizedAt')
    AND (h.kind = 'hold' OR h.retain_until > h.created_at))
  OR NOT EXISTS (SELECT 1 FROM system_record_disclosure_policies p
    WHERE p.id = NEW.disclosure_policy_id AND p.revision = NEW.disclosure_policy_revision
      AND p.record_id = NEW.id AND json_extract(p.snapshot_json, '$.status') = 'active'
      AND julianday(json_extract(p.snapshot_json, '$.publishedAt')) <= julianday(json_extract(NEW.snapshot_json, '$.finalizedAt'))
      AND NOT EXISTS (SELECT 1 FROM system_record_disclosure_policies later WHERE later.id = p.id AND later.revision > p.revision))
  OR NOT EXISTS (SELECT 1 FROM system_audit_events a WHERE a.event_id = NEW.audit_event_id
    AND a.action = 'system.record.preserved' AND a.target_type = 'system:preserved-record'
    AND a.target_id = NEW.id AND a.outcome = 'succeeded'
    AND a.actor_account_id = json_extract(NEW.snapshot_json, '$.actorAccountId')
    AND a.after_json = NEW.snapshot_json
    AND strftime('%Y-%m-%dT%H:%M:%fZ', a.occurred_at / 1000.0, 'unixepoch') = json_extract(NEW.snapshot_json, '$.finalizedAt'))
BEGIN
  SELECT RAISE(ABORT, 'preserved_record_dependencies_invalid');
END;

CREATE TRIGGER system_preserved_record_prevent_delete
BEFORE DELETE ON system_preserved_records
BEGIN
  SELECT RAISE(ABORT, 'preserved_record_immutable');
END;

CREATE TRIGGER system_preserved_record_prevent_update
BEFORE UPDATE ON system_preserved_records
BEGIN
  SELECT RAISE(ABORT, 'preserved_record_immutable');
END;

CREATE TRIGGER system_principals_identity_update
BEFORE UPDATE OF id, legacy_id ON system_principals
WHEN NEW.id IS NOT OLD.id OR NEW.legacy_id IS NOT OLD.legacy_id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

CREATE TRIGGER system_principals_legacy_id_insert
BEFORE INSERT ON system_principals
WHEN NEW.legacy_id IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'record_legacy_id_immutable'); END;

CREATE TRIGGER system_principals_revision_step
BEFORE UPDATE ON system_principals
WHEN NEW.revision <> OLD.revision + 1 OR NEW.updated_at < OLD.updated_at
BEGIN
  SELECT RAISE(ABORT, 'system_principal_revision_conflict');
END;

CREATE TRIGGER system_procedure_definition_revisions_identity_update
BEFORE UPDATE OF id ON system_procedure_definition_revisions
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

CREATE TRIGGER system_procedure_definition_revisions_prevent_delete
BEFORE DELETE ON system_procedure_definition_revisions
BEGIN
  SELECT RAISE(ABORT, 'system procedure revision is immutable');
END;

CREATE TRIGGER system_procedure_definition_revisions_prevent_update
BEFORE UPDATE ON system_procedure_definition_revisions
BEGIN
  SELECT RAISE(ABORT, 'system procedure revision is immutable');
END;

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

CREATE TRIGGER system_procedure_definitions_identity_update
BEFORE UPDATE OF id ON system_procedure_definitions
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

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

CREATE TRIGGER system_procedure_definitions_prevent_delete
BEFORE DELETE ON system_procedure_definitions
BEGIN
  SELECT RAISE(ABORT, 'system procedure is immutable');
END;

CREATE TRIGGER system_procedure_numbers_prevent_delete
BEFORE DELETE ON system_procedure_numbers
BEGIN
  SELECT RAISE(ABORT, 'system procedure number is immutable');
END;

CREATE TRIGGER system_procedure_numbers_prevent_update
BEFORE UPDATE ON system_procedure_numbers
BEGIN
  SELECT RAISE(ABORT, 'system procedure number is immutable');
END;

CREATE TRIGGER system_proposal_cases_prevent_delete
BEFORE DELETE ON system_proposal_cases
BEGIN
  SELECT RAISE(ABORT, 'system proposal case is immutable');
END;

CREATE TRIGGER system_proposal_cases_prevent_update
BEFORE UPDATE ON system_proposal_cases
BEGIN
  SELECT RAISE(ABORT, 'system proposal case is immutable');
END;

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
      OR (
        workflow_case.subject_context = 'system'
        AND workflow_case.subject_kind = 'record-preservation'
        AND workflow_case.subject_version = '1'
        AND json_extract(proposal.body_json, '$.operation') IS 'system.record.preserve'
        AND json_extract(proposal.body_json, '$.version') IS 1
        AND json_extract(proposal.body_json, '$.recordId') IS workflow_case.subject_id
      )
    )
    AND workflow_case.proposal_digest = proposal.digest
    AND workflow_case.created_by_account_id = proposal.created_by_account_id
    AND workflow_case.created_at = NEW.linked_at
)
BEGIN
  SELECT RAISE(ABORT, 'system proposal case does not match');
END;

CREATE TRIGGER system_proposal_numbers_prevent_delete
BEFORE DELETE ON system_proposal_numbers
BEGIN
  SELECT RAISE(ABORT, 'system proposal number is immutable');
END;

CREATE TRIGGER system_proposal_numbers_prevent_update
BEFORE UPDATE ON system_proposal_numbers
BEGIN
  SELECT RAISE(ABORT, 'system proposal number is immutable');
END;

CREATE TRIGGER system_proposal_series_prevent_delete
BEFORE DELETE ON system_proposal_series
BEGIN
  SELECT RAISE(ABORT, 'system proposal series is immutable');
END;

CREATE TRIGGER system_proposal_series_prevent_update
BEFORE UPDATE ON system_proposal_series
BEGIN
  SELECT RAISE(ABORT, 'system proposal series is immutable');
END;

CREATE TRIGGER system_proposals_prevent_delete
BEFORE DELETE ON system_proposals
BEGIN
  SELECT RAISE(ABORT, 'system proposal is immutable');
END;

CREATE TRIGGER system_proposals_prevent_update
BEFORE UPDATE ON system_proposals
BEGIN
  SELECT RAISE(ABORT, 'system proposal is immutable');
END;

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

CREATE TRIGGER system_reconciliation_items_identity_update
BEFORE UPDATE OF id ON system_reconciliation_items
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

CREATE TRIGGER system_reconciliation_items_no_delete
BEFORE DELETE ON system_reconciliation_items
BEGIN
  SELECT RAISE(ABORT, 'system_reconciliation_items_are_immutable');
END;

CREATE TRIGGER system_reconciliation_items_no_update
BEFORE UPDATE ON system_reconciliation_items
BEGIN
  SELECT RAISE(ABORT, 'system_reconciliation_items_are_immutable');
END;

CREATE TRIGGER system_reconciliation_runs_no_delete
BEFORE DELETE ON system_reconciliation_runs
BEGIN
  SELECT RAISE(ABORT, 'system_reconciliation_runs_are_immutable');
END;

CREATE TRIGGER system_reconciliation_runs_no_update
BEFORE UPDATE ON system_reconciliation_runs
BEGIN
  SELECT RAISE(ABORT, 'system_reconciliation_runs_are_immutable');
END;

CREATE TRIGGER system_record_coverage_entries_delete BEFORE DELETE ON system_record_coverage_entries
BEGIN
  SELECT RAISE(ABORT,'record_coverage_immutable');
END;

CREATE TRIGGER system_record_coverage_entries_identity_update
BEFORE UPDATE OF id ON system_record_coverage_entries
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

CREATE TRIGGER system_record_coverage_entries_insert BEFORE INSERT ON system_record_coverage_entries
BEGIN
  SELECT RAISE(ABORT,'record_coverage_entry_duplicate') WHERE EXISTS (
    SELECT 1 FROM system_record_coverage_entries WHERE freeze_id=NEW.freeze_id
      AND ((record_kind=NEW.record_kind AND source_record_id=NEW.source_record_id) OR preserved_record_id=NEW.preserved_record_id)
  );
  SELECT RAISE(ABORT,'record_coverage_source_mismatch') WHERE NOT EXISTS (
    SELECT 1 FROM system_record_coverage_pages p, json_each(p.snapshot_json,'$.records') item
    JOIN system_preserved_records r ON r.id=NEW.preserved_record_id
    WHERE p.id=NEW.page_id AND p.freeze_id=NEW.freeze_id AND p.record_kind=NEW.record_kind
      AND json_extract(item.value,'$.preservedRecordId') IS NEW.preserved_record_id
      AND json_extract(item.value,'$.source.recordId') IS NEW.source_record_id
      AND json_extract(item.value,'$.source.sourceNamespace') IS json_extract(p.snapshot_json,'$.sourceNamespace')
      AND json_extract(item.value,'$.source.ownerContext') IS json_extract(p.snapshot_json,'$.ownerContext')
      AND json_extract(item.value,'$.source.recordKind') IS NEW.record_kind
      AND json_extract(item.value,'$.source') IS json_extract(r.snapshot_json,'$.source')
  );
END;

CREATE TRIGGER system_record_coverage_entries_update BEFORE UPDATE ON system_record_coverage_entries
BEGIN
  SELECT RAISE(ABORT,'record_coverage_immutable');
END;

CREATE TRIGGER system_record_coverage_pages_delete BEFORE DELETE ON system_record_coverage_pages
BEGIN
  SELECT RAISE(ABORT,'record_coverage_immutable');
END;

CREATE TRIGGER system_record_coverage_pages_index AFTER INSERT ON system_record_coverage_pages
BEGIN
  INSERT INTO system_record_coverage_entries(page_id,freeze_id,record_kind,source_record_id,preserved_record_id)
    SELECT NEW.id,NEW.freeze_id,NEW.record_kind,json_extract(item.value,'$.source.recordId'),json_extract(item.value,'$.preservedRecordId')
    FROM json_each(NEW.snapshot_json,'$.records') item;
END;

CREATE TRIGGER system_record_coverage_pages_insert BEFORE INSERT ON system_record_coverage_pages
BEGIN
  SELECT RAISE(ABORT,'record_coverage_page_conflict') WHERE EXISTS (
    SELECT 1 FROM system_record_coverage_pages WHERE id=NEW.id
      OR (freeze_id=NEW.freeze_id AND record_kind=NEW.record_kind AND sequence>=NEW.sequence)
  );
  SELECT RAISE(ABORT,'record_coverage_freeze_unavailable') WHERE NOT EXISTS (
    SELECT 1 FROM system_record_source_freezes WHERE id=NEW.freeze_id AND revision=1
      AND source_namespace IS json_extract(NEW.snapshot_json,'$.sourceNamespace')
      AND owner_context IS json_extract(NEW.snapshot_json,'$.ownerContext')
  );
  SELECT RAISE(ABORT,'record_coverage_page_gap') WHERE
    (NEW.sequence=1 AND (NEW.previous_digest IS NOT NULL OR NEW.after_cursor IS NOT NULL))
    OR (NEW.sequence>1 AND NOT EXISTS (
      SELECT 1 FROM system_record_coverage_pages p WHERE p.freeze_id=NEW.freeze_id
        AND p.record_kind=NEW.record_kind AND p.sequence=NEW.sequence-1
        AND p.digest IS NEW.previous_digest AND p.next_cursor IS NOT NULL AND p.next_cursor IS NEW.after_cursor
        AND julianday(json_extract(NEW.snapshot_json,'$.checkedAt')) >= julianday(json_extract(p.snapshot_json,'$.checkedAt'))
    ));
  SELECT RAISE(ABORT,'record_coverage_audit_missing') WHERE NOT EXISTS (
    SELECT 1 FROM system_audit_events a WHERE a.event_id=NEW.audit_event_id
      AND a.action='system.record.coverage.page.verified' AND a.target_type='system:record-coverage-page'
      AND a.target_id=NEW.id AND a.outcome='succeeded'
      AND a.actor_account_id IS json_extract(NEW.snapshot_json,'$.actorAccountId')
      AND a.after_json IS NEW.snapshot_json
      AND a.before_json IS (SELECT p.snapshot_json FROM system_record_coverage_pages p WHERE p.freeze_id=NEW.freeze_id AND p.record_kind=NEW.record_kind AND p.sequence=NEW.sequence-1)
      AND strftime('%Y-%m-%dT%H:%M:%fZ',a.occurred_at/1000.0,'unixepoch') IS json_extract(NEW.snapshot_json,'$.checkedAt')
  );
END;

CREATE TRIGGER system_record_coverage_pages_update BEFORE UPDATE ON system_record_coverage_pages
BEGIN
  SELECT RAISE(ABORT,'record_coverage_immutable');
END;

CREATE TRIGGER system_record_disclosure_policies_identity_update
BEFORE UPDATE OF id ON system_record_disclosure_policies
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

CREATE TRIGGER system_record_disclosure_prevent_delete
BEFORE DELETE ON system_record_disclosure_policies
BEGIN
  SELECT RAISE(ABORT, 'record_disclosure_history_immutable');
END;

CREATE TRIGGER system_record_disclosure_prevent_update
BEFORE UPDATE ON system_record_disclosure_policies
BEGIN
  SELECT RAISE(ABORT, 'record_disclosure_history_immutable');
END;

CREATE TRIGGER system_record_disclosure_publication_guard
BEFORE INSERT ON system_record_disclosure_policies
WHEN NEW.revision != COALESCE((SELECT MAX(revision) FROM system_record_disclosure_policies WHERE id = NEW.id), 0) + 1
  OR EXISTS (SELECT 1 FROM system_record_disclosure_policies p WHERE p.id = NEW.id AND (
    p.record_id != NEW.record_id OR julianday(json_extract(p.snapshot_json, '$.publishedAt')) > julianday(json_extract(NEW.snapshot_json, '$.publishedAt'))))
  OR NOT EXISTS (SELECT 1 FROM system_audit_events a WHERE a.event_id = NEW.audit_event_id
    AND a.action = 'system.record.disclosure_policy.published' AND a.target_type = 'system:record-disclosure-policy'
    AND a.target_id = NEW.id AND a.outcome = 'succeeded'
    AND a.actor_account_id = json_extract(NEW.snapshot_json, '$.actorAccountId')
    AND a.after_json = NEW.snapshot_json
    AND strftime('%Y-%m-%dT%H:%M:%fZ', a.occurred_at / 1000.0, 'unixepoch') = json_extract(NEW.snapshot_json, '$.publishedAt'))
BEGIN
  SELECT RAISE(ABORT, 'record_disclosure_publication_invalid');
END;

CREATE TRIGGER system_record_retirement_attachment_pins_delete BEFORE DELETE ON system_record_retirement_attachment_pins
BEGIN
  SELECT RAISE(ABORT,'record_retirement_attachment_pin_immutable');
END;

CREATE TRIGGER system_record_retirement_attachment_pins_identity_update
BEFORE UPDATE OF id ON system_record_retirement_attachment_pins
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

CREATE TRIGGER system_record_retirement_attachment_pins_insert BEFORE INSERT ON system_record_retirement_attachment_pins
BEGIN
  SELECT RAISE(ABORT,'record_retirement_attachment_pin_duplicate') WHERE EXISTS (
    SELECT 1 FROM system_record_retirement_attachment_pins WHERE receipt_id=NEW.receipt_id AND attachment_id=NEW.attachment_id
  );
  SELECT RAISE(ABORT,'record_retirement_attachment_pin_invalid') WHERE NOT EXISTS (
    SELECT 1 FROM system_record_retirement_receipts receipt
    JOIN system_record_retirement_plans plan ON plan.id=receipt.plan_id
    JOIN system_record_source_freezes freeze ON freeze.id=plan.freeze_id AND freeze.revision=1
    JOIN system_record_coverage_pages page ON page.id=receipt.coverage_page_id
    JOIN json_each(page.snapshot_json,'$.records') item
    JOIN system_attachments attachment ON attachment.id=NEW.attachment_id
    WHERE receipt.id=NEW.receipt_id
      AND json_extract(item.value,'$.source.recordId') IS NEW.attachment_id
      AND json_extract(item.value,'$.source.formatId')='system-attachment-record'
      AND json_extract(item.value,'$.source.formatVersion') IS 1
      AND attachment.status='linked' AND attachment.erased_at IS NULL
      AND attachment.wrapped_dek IS NOT NULL AND attachment.wrapped_dek_iv IS NOT NULL
      AND attachment.linked_at IS NOT NULL AND attachment.created_at<=attachment.linked_at
      AND attachment.linked_at<=round((julianday(json_extract(receipt.snapshot_json,'$.checkedAt'))-2440587.5)*86400000)
  );
END;

CREATE TRIGGER system_record_retirement_attachment_pins_update BEFORE UPDATE ON system_record_retirement_attachment_pins
BEGIN
  SELECT RAISE(ABORT,'record_retirement_attachment_pin_immutable');
END;

CREATE TRIGGER system_record_retirement_plans_delete BEFORE DELETE ON system_record_retirement_plans
BEGIN
  SELECT RAISE(ABORT,'record_retirement_plan_immutable');
END;

CREATE TRIGGER system_record_retirement_plans_insert BEFORE INSERT ON system_record_retirement_plans
BEGIN
  SELECT RAISE(ABORT,'record_retirement_plan_conflict') WHERE EXISTS (
    SELECT 1 FROM system_record_retirement_plans WHERE id=NEW.id
  );
  SELECT RAISE(ABORT,'record_retirement_plan_freeze_unavailable') WHERE NOT EXISTS (
    SELECT 1 FROM system_record_source_freezes WHERE id=NEW.freeze_id AND revision=1
      AND source_namespace IS json_extract(NEW.snapshot_json,'$.sourceNamespace')
      AND owner_context IS json_extract(NEW.snapshot_json,'$.ownerContext')
      AND julianday(json_extract(snapshot_json,'$.createdAt')) <= julianday(json_extract(NEW.snapshot_json,'$.createdAt'))
  );
  SELECT RAISE(ABORT,'record_retirement_plan_coverage_invalid') WHERE EXISTS (
    SELECT 1 FROM json_each(NEW.snapshot_json,'$.coverage') c
    WHERE json_extract(c.value,'$.recordKind') IS NOT json_extract(NEW.snapshot_json,'$.capability.recordKinds[' || c.key || ']')
      OR NOT EXISTS (
        SELECT 1 FROM system_record_coverage_pages p
        WHERE p.id IS json_extract(c.value,'$.terminalPageId') AND p.freeze_id=NEW.freeze_id
          AND p.record_kind IS json_extract(c.value,'$.recordKind') AND p.next_cursor IS NULL
          AND p.digest IS json_extract(c.value,'$.terminalDigest')
          AND p.sequence IS json_extract(c.value,'$.pageCount')
          AND json_extract(p.snapshot_json,'$.purpose') IS json_extract(NEW.snapshot_json,'$.purpose')
          AND julianday(json_extract(p.snapshot_json,'$.checkedAt')) <= julianday(json_extract(NEW.snapshot_json,'$.createdAt'))
          AND (SELECT count(*) FROM system_record_coverage_entries e WHERE e.freeze_id=NEW.freeze_id AND e.record_kind=p.record_kind)
            IS json_extract(c.value,'$.recordCount')
      )
  );
  SELECT RAISE(ABORT,'record_retirement_plan_coverage_invalid') WHERE
    (SELECT count(DISTINCT json_extract(value,'$.recordKind')) FROM json_each(NEW.snapshot_json,'$.coverage'))
      <> json_array_length(NEW.snapshot_json,'$.coverage');
  SELECT RAISE(ABORT,'record_retirement_plan_audit_missing') WHERE NOT EXISTS (
    SELECT 1 FROM system_audit_events a WHERE a.event_id=NEW.audit_event_id
      AND a.action='system.record.retirement.plan.created' AND a.target_type='system:record-retirement-plan'
      AND a.target_id=NEW.id AND a.outcome='succeeded' AND a.before_json IS NULL
      AND a.actor_account_id IS json_extract(NEW.snapshot_json,'$.actorAccountId')
      AND a.after_json IS NEW.snapshot_json
      AND strftime('%Y-%m-%dT%H:%M:%fZ',a.occurred_at/1000.0,'unixepoch') IS json_extract(NEW.snapshot_json,'$.createdAt')
  );
END;

CREATE TRIGGER system_record_retirement_plans_update BEFORE UPDATE ON system_record_retirement_plans
BEGIN
  SELECT RAISE(ABORT,'record_retirement_plan_immutable');
END;

CREATE TRIGGER system_record_retirement_receipts_delete BEFORE DELETE ON system_record_retirement_receipts
BEGIN
  SELECT RAISE(ABORT,'record_retirement_receipt_immutable');
END;

CREATE TRIGGER system_record_retirement_receipts_insert BEFORE INSERT ON system_record_retirement_receipts
BEGIN
  SELECT RAISE(ABORT,'record_retirement_receipt_conflict') WHERE EXISTS (
    SELECT 1 FROM system_record_retirement_receipts WHERE id=NEW.id
      OR (plan_id=NEW.plan_id AND (ordinal>=NEW.ordinal OR coverage_page_id=NEW.coverage_page_id))
  );
  SELECT RAISE(ABORT,'record_retirement_receipt_plan_invalid') WHERE NOT EXISTS (
    SELECT 1 FROM system_record_retirement_plans plan
    JOIN system_record_source_freezes freeze ON freeze.id=plan.freeze_id AND freeze.revision=1
    JOIN json_each(plan.snapshot_json,'$.coverage') c
    JOIN system_record_coverage_pages page ON page.id=NEW.coverage_page_id
      AND page.freeze_id=plan.freeze_id AND page.record_kind IS json_extract(c.value,'$.recordKind')
    WHERE plan.id=NEW.plan_id AND plan.digest IS json_extract(NEW.snapshot_json,'$.planDigest')
      AND page.digest IS json_extract(NEW.snapshot_json,'$.coveragePageDigest')
      AND page.sequence <= json_extract(c.value,'$.pageCount')
      AND NEW.ordinal IS page.sequence + (SELECT coalesce(sum(json_extract(prior.value,'$.pageCount')),0)
        FROM json_each(plan.snapshot_json,'$.coverage') prior WHERE prior.key<c.key)
      AND julianday(json_extract(NEW.snapshot_json,'$.checkedAt')) >= julianday(json_extract(plan.snapshot_json,'$.createdAt'))
      AND julianday(json_extract(NEW.snapshot_json,'$.checkedAt')) >= julianday(json_extract(page.snapshot_json,'$.checkedAt'))
  );
  SELECT RAISE(ABORT,'record_retirement_receipt_order_invalid') WHERE
    (NEW.ordinal=1 AND json_type(NEW.snapshot_json,'$.previousReceiptDigest') IS NOT 'null')
    OR (NEW.ordinal>1 AND NOT EXISTS (
      SELECT 1 FROM system_record_retirement_receipts previous
      WHERE previous.plan_id=NEW.plan_id AND previous.ordinal=NEW.ordinal-1
        AND previous.digest IS json_extract(NEW.snapshot_json,'$.previousReceiptDigest')
        AND julianday(json_extract(NEW.snapshot_json,'$.checkedAt')) >= julianday(json_extract(previous.snapshot_json,'$.checkedAt'))
    ));
  SELECT RAISE(ABORT,'record_retirement_receipt_audit_missing') WHERE NOT EXISTS (
    SELECT 1 FROM system_audit_events a WHERE a.event_id=NEW.audit_event_id
      AND a.action='system.record.retirement.page.verified' AND a.target_type='system:record-retirement-receipt'
      AND a.target_id=NEW.id AND a.outcome='succeeded' AND a.before_json IS NULL
      AND a.actor_account_id IS json_extract(NEW.snapshot_json,'$.actorAccountId')
      AND a.after_json IS NEW.snapshot_json
      AND strftime('%Y-%m-%dT%H:%M:%fZ',a.occurred_at/1000.0,'unixepoch') IS json_extract(NEW.snapshot_json,'$.checkedAt')
  );
END;

CREATE TRIGGER system_record_retirement_receipts_pin_attachments AFTER INSERT ON system_record_retirement_receipts
BEGIN
  SELECT RAISE(ABORT,'record_retirement_attachment_format_unsupported') WHERE EXISTS (
    SELECT 1 FROM system_record_coverage_pages page, json_each(page.snapshot_json,'$.records') item
    WHERE page.id=NEW.coverage_page_id
      AND json_extract(item.value,'$.source.formatId')='system-attachment-record'
      AND json_extract(item.value,'$.source.formatVersion') IS NOT 1
  );
  INSERT INTO system_record_retirement_attachment_pins(receipt_id,attachment_id)
    SELECT NEW.id,json_extract(item.value,'$.source.recordId')
    FROM system_record_coverage_pages page, json_each(page.snapshot_json,'$.records') item
    WHERE page.id=NEW.coverage_page_id AND json_extract(item.value,'$.source.formatId')='system-attachment-record';
END;

CREATE TRIGGER system_record_retirement_receipts_storage_keys BEFORE INSERT ON system_record_retirement_receipts
BEGIN
  SELECT RAISE(ABORT,'record_retirement_storage_keys_invalid') WHERE
    json_type(NEW.snapshot_json,'$.storageKeys') IS NOT 'array'
    OR json_array_length(NEW.snapshot_json,'$.storageKeys')>200
    OR (SELECT count(DISTINCT json_extract(value,'$.version')) FROM json_each(NEW.snapshot_json,'$.storageKeys'))
      <>json_array_length(NEW.snapshot_json,'$.storageKeys')
    OR EXISTS (SELECT 1 FROM json_each(NEW.snapshot_json,'$.storageKeys') key
      WHERE json_type(key.value,'$.version') IS NOT 'integer' OR json_extract(key.value,'$.version')<=0
        OR length(json_extract(key.value,'$.digest')) IS NOT 64
        OR json_extract(key.value,'$.digest') GLOB '*[^0-9a-f]*');
  SELECT RAISE(ABORT,'record_retirement_storage_keys_incomplete') WHERE
    EXISTS (SELECT 1 FROM (SELECT attachment.kek_version AS version FROM system_record_coverage_pages page
      JOIN json_each(page.snapshot_json,'$.records') item
      JOIN system_preserved_records record ON record.id=json_extract(item.value,'$.preservedRecordId')
      JOIN system_attachments attachment ON attachment.id=record.attachment_id WHERE page.id=NEW.coverage_page_id
      UNION SELECT attachment.kek_version AS version FROM system_record_coverage_pages page
      JOIN json_each(page.snapshot_json,'$.records') item
      JOIN system_attachments attachment ON attachment.id=json_extract(item.value,'$.source.recordId')
      WHERE page.id=NEW.coverage_page_id AND json_extract(item.value,'$.source.formatId')='system-attachment-record' ) expected WHERE NOT EXISTS (
      SELECT 1 FROM json_each(NEW.snapshot_json,'$.storageKeys') key WHERE json_extract(key.value,'$.version') IS expected.version
    )) OR EXISTS (SELECT 1 FROM json_each(NEW.snapshot_json,'$.storageKeys') key WHERE NOT EXISTS (
      SELECT 1 FROM (SELECT attachment.kek_version AS version FROM system_record_coverage_pages page
      JOIN json_each(page.snapshot_json,'$.records') item
      JOIN system_preserved_records record ON record.id=json_extract(item.value,'$.preservedRecordId')
      JOIN system_attachments attachment ON attachment.id=record.attachment_id WHERE page.id=NEW.coverage_page_id
      UNION SELECT attachment.kek_version AS version FROM system_record_coverage_pages page
      JOIN json_each(page.snapshot_json,'$.records') item
      JOIN system_attachments attachment ON attachment.id=json_extract(item.value,'$.source.recordId')
      WHERE page.id=NEW.coverage_page_id AND json_extract(item.value,'$.source.formatId')='system-attachment-record' ) expected WHERE expected.version IS json_extract(key.value,'$.version')
    ));
END;

CREATE TRIGGER system_record_retirement_receipts_update BEFORE UPDATE ON system_record_retirement_receipts
BEGIN
  SELECT RAISE(ABORT,'record_retirement_receipt_immutable');
END;

CREATE TRIGGER system_record_source_freezes_delete
BEFORE DELETE ON system_record_source_freezes
BEGIN
  SELECT RAISE(ABORT, 'record_source_freeze_immutable');
END;

CREATE TRIGGER system_record_source_freezes_insert
BEFORE INSERT ON system_record_source_freezes
BEGIN
  SELECT RAISE(ABORT, 'record_source_freeze_creation_invalid') WHERE NEW.revision <> 1
    OR EXISTS (SELECT 1 FROM system_record_source_freezes
      WHERE id = NEW.id OR (owner_context = NEW.owner_context AND revision = 1));
  SELECT RAISE(ABORT, 'record_source_freeze_audit_missing') WHERE NOT EXISTS (
    SELECT 1 FROM system_audit_events WHERE event_id = NEW.created_audit_event_id
      AND actor_account_id = json_extract(NEW.snapshot_json, '$.actorAccountId')
      AND action = 'system.record.source.freeze.created' AND target_type = 'system:record-source-freeze'
      AND target_id = NEW.id AND outcome = 'succeeded' AND before_json IS NULL
      AND after_json IS NEW.snapshot_json
      AND strftime('%Y-%m-%dT%H:%M:%fZ', occurred_at / 1000.0, 'unixepoch') IS json_extract(NEW.snapshot_json, '$.createdAt')
  );
END;

CREATE TRIGGER system_record_source_freezes_update
BEFORE UPDATE ON system_record_source_freezes
BEGIN
  SELECT RAISE(ABORT, 'record_source_freeze_immutable')
  WHERE OLD.revision <> 1 OR NEW.revision <> 2 OR NEW.id IS NOT OLD.id
    OR NEW.source_namespace IS NOT OLD.source_namespace OR NEW.owner_context IS NOT OLD.owner_context
    OR NEW.created_audit_event_id IS NOT OLD.created_audit_event_id
    OR json_remove(NEW.snapshot_json, '$.release', '$.revision') IS NOT json_remove(OLD.snapshot_json, '$.release', '$.revision');
  SELECT RAISE(ABORT, 'record_source_freeze_audit_missing') WHERE NOT EXISTS (
    SELECT 1 FROM system_audit_events WHERE event_id = NEW.release_audit_event_id
      AND actor_account_id = json_extract(NEW.snapshot_json, '$.release.actorAccountId')
      AND action = 'system.record.source.freeze.released' AND target_type = 'system:record-source-freeze'
      AND target_id = NEW.id AND outcome = 'succeeded'
      AND before_json IS OLD.snapshot_json AND after_json IS NEW.snapshot_json
      AND strftime('%Y-%m-%dT%H:%M:%fZ', occurred_at / 1000.0, 'unixepoch') IS json_extract(NEW.snapshot_json, '$.release.at')
  );
END;

CREATE TRIGGER system_record_source_retirement_prevents_release BEFORE UPDATE ON system_record_source_freezes
WHEN EXISTS (SELECT 1 FROM system_record_source_retirements WHERE freeze_id=OLD.id)
BEGIN
  SELECT RAISE(ABORT,'record_source_already_retired');
END;

CREATE TRIGGER system_record_source_retirements_delete BEFORE DELETE ON system_record_source_retirements
BEGIN
  SELECT RAISE(ABORT,'record_source_retirement_immutable');
END;

CREATE TRIGGER system_record_source_retirements_insert BEFORE INSERT ON system_record_source_retirements
BEGIN
  SELECT RAISE(ABORT,'record_source_retirement_execution_invalid') WHERE NOT EXISTS (
    SELECT 1 FROM system_execution_authorizations authorization
    JOIN system_cases workflow_case ON workflow_case.id=authorization.case_id
    JOIN system_proposal_cases link ON link.case_id=workflow_case.id
    JOIN system_proposals proposal ON proposal.id=link.proposal_id
    JOIN system_record_retirement_plans plan ON plan.id=NEW.plan_id
    JOIN system_record_source_freezes freeze ON freeze.id=NEW.freeze_id AND freeze.revision=1
    JOIN system_record_retirement_receipts receipt ON receipt.id=NEW.terminal_receipt_id
    WHERE authorization.id=NEW.execution_authorization_id AND authorization.case_id=NEW.case_id
      AND authorization.operation_key='system.record.retire' AND authorization.used_at IS NOT NULL
      AND authorization.granted_at<=authorization.used_at AND authorization.expires_at>authorization.used_at
      AND workflow_case.status='executed' AND workflow_case.proposal_digest=authorization.proposal_digest
      AND workflow_case.updated_at=authorization.used_at
      AND proposal.id=NEW.proposal_id AND proposal.digest=authorization.proposal_digest
      AND proposal.version IS json_extract(NEW.snapshot_json,'$.proposalVersion')
      AND proposal.digest IS json_extract(NEW.snapshot_json,'$.proposalDigest')
      AND proposal.created_by_account_id=authorization.granted_to_account_id
      AND authorization.granted_to_account_id IS json_extract(NEW.snapshot_json,'$.actorAccountId')
      AND json_extract(proposal.body_json,'$.operation')='system.record.retire'
      AND json_extract(proposal.body_json,'$.actorAccountId')=authorization.granted_to_account_id
      AND json_extract(proposal.body_json,'$.plan.id')=plan.id AND plan.freeze_id=freeze.id
      AND json_extract(proposal.body_json,'$.plan.freezeId')=freeze.id
      AND json_extract(proposal.body_json,'$.plan.sourceNamespace')=freeze.source_namespace
      AND json_extract(proposal.body_json,'$.plan.ownerContext')=freeze.owner_context
      AND json_extract(proposal.body_json,'$.planDigest')=plan.digest
      AND plan.digest IS json_extract(NEW.snapshot_json,'$.planDigest')
      AND json_extract(proposal.body_json,'$.terminalReceipt.id')=receipt.id AND receipt.plan_id=plan.id
      AND json_extract(proposal.body_json,'$.terminalReceiptDigest')=receipt.digest
      AND receipt.digest IS json_extract(NEW.snapshot_json,'$.terminalReceiptDigest')
      AND receipt.ordinal=(SELECT sum(json_extract(value,'$.pageCount')) FROM json_each(plan.snapshot_json,'$.coverage'))
      AND julianday(json_extract(receipt.snapshot_json,'$.checkedAt'))<=julianday(json_extract(NEW.snapshot_json,'$.finalizedAt'))
      AND strftime('%Y-%m-%dT%H:%M:%fZ',authorization.used_at/1000.0,'unixepoch') IS json_extract(NEW.snapshot_json,'$.finalizedAt')
  );
  SELECT RAISE(ABORT,'record_source_retirement_audit_missing') WHERE NOT EXISTS (
    SELECT 1 FROM system_audit_events audit WHERE audit.event_id=NEW.audit_event_id
      AND audit.action='system.record.source.retired' AND audit.target_type='system:record-source-retirement'
      AND audit.target_id=NEW.id AND audit.outcome='succeeded' AND audit.before_json IS NULL
      AND audit.after_json IS NEW.snapshot_json
      AND audit.actor_account_id IS json_extract(NEW.snapshot_json,'$.actorAccountId')
      AND json_extract(audit.authorization_json,'$.executionAuthorizationId') IS NEW.execution_authorization_id
      AND strftime('%Y-%m-%dT%H:%M:%fZ',audit.occurred_at/1000.0,'unixepoch') IS json_extract(NEW.snapshot_json,'$.finalizedAt')
  );
END;

CREATE TRIGGER system_record_source_retirements_update BEFORE UPDATE ON system_record_source_retirements
BEGIN
  SELECT RAISE(ABORT,'record_source_retirement_immutable');
END;

CREATE TRIGGER system_role_bindings_closed_account_guard
BEFORE INSERT ON system_role_bindings
WHEN EXISTS (
  SELECT 1 FROM system_accounts
  WHERE id = NEW.account_id AND closed_at IS NOT NULL
)
BEGIN
  SELECT RAISE(ABORT, 'closed account cannot receive a role binding');
END;

CREATE TRIGGER system_role_bindings_identity_update
BEFORE UPDATE OF id, legacy_id ON system_role_bindings
WHEN NEW.id IS NOT OLD.id OR NEW.legacy_id IS NOT OLD.legacy_id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

CREATE TRIGGER system_role_bindings_legacy_id_insert
BEFORE INSERT ON system_role_bindings
WHEN NEW.legacy_id IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'record_legacy_id_immutable'); END;

CREATE TRIGGER system_role_bindings_monotonic_lifecycle
BEFORE UPDATE ON system_role_bindings
WHEN
  NEW.id IS NOT OLD.id
  OR NEW.account_id IS NOT OLD.account_id
  OR NEW.role_id IS NOT OLD.role_id
  OR NEW.resource_type IS NOT OLD.resource_type
  OR NEW.resource_id IS NOT OLD.resource_id
  OR NEW.created_at IS NOT OLD.created_at
  OR (OLD.revoked_at IS NOT NULL AND NEW.revoked_at IS NOT OLD.revoked_at)
BEGIN
  SELECT RAISE(ABORT, 'role binding lifecycle is not monotonic');
END;

CREATE TRIGGER system_sessions_closed_account_guard
BEFORE INSERT ON system_sessions
WHEN EXISTS (
  SELECT 1 FROM system_accounts
  WHERE id = NEW.account_id AND closed_at IS NOT NULL
)
BEGIN
  SELECT RAISE(ABORT, 'closed account cannot receive a session');
END;

CREATE TRIGGER system_sessions_monotonic_lifecycle
BEFORE UPDATE ON system_sessions
WHEN
  NEW.id IS NOT OLD.id
  OR NEW.account_id IS NOT OLD.account_id
  OR NEW.family_id IS NOT OLD.family_id
  OR NEW.token_hash IS NOT OLD.token_hash
  OR NEW.token_version IS NOT OLD.token_version
  OR NEW.created_at IS NOT OLD.created_at
  OR NEW.expires_at IS NOT OLD.expires_at
  OR (OLD.authenticated_at IS NOT NULL AND NEW.authenticated_at IS NOT OLD.authenticated_at)
  OR (OLD.rotated_at IS NOT NULL AND NEW.rotated_at IS NOT OLD.rotated_at)
  OR (OLD.revoked_at IS NOT NULL AND NEW.revoked_at IS NOT OLD.revoked_at)
BEGIN
  SELECT RAISE(ABORT, 'session lifecycle is not monotonic');
END;

CREATE TRIGGER system_step_up_grants_monotonic_update
BEFORE UPDATE ON system_step_up_grants
WHEN NEW.account_id <> OLD.account_id
  OR NEW.token_hash <> OLD.token_hash
  OR NEW.method <> OLD.method
  OR NEW.issued_at <> OLD.issued_at
  OR NEW.expires_at <> OLD.expires_at
  OR (OLD.last_used_at IS NOT NULL AND (NEW.last_used_at IS NULL OR NEW.last_used_at < OLD.last_used_at))
  OR (OLD.revoked_at IS NOT NULL AND NEW.revoked_at <> OLD.revoked_at)
BEGIN
  SELECT RAISE(ABORT, 'system_step_up_grant_update_invalid');
END;

CREATE TRIGGER system_step_up_grants_no_delete
BEFORE DELETE ON system_step_up_grants
BEGIN
  SELECT RAISE(ABORT, 'system_step_up_grants_are_retained');
END;

CREATE TRIGGER system_work_evidence_delete BEFORE DELETE ON system_work_evidence
BEGIN
  SELECT RAISE(ABORT, 'work item records are immutable');
END;

CREATE TRIGGER system_work_evidence_insert BEFORE INSERT ON system_work_evidence
BEGIN
  SELECT RAISE(ABORT, 'work_item_evidence_unavailable') WHERE NOT EXISTS (
    SELECT 1 FROM system_work_item_revisions revision, json_each(revision.snapshot_json,'$.result.evidence') evidence
    JOIN system_attachments attachment ON attachment.id=json_extract(evidence.value,'$.attachmentId')
    WHERE revision.command_id=NEW.command_id AND revision.work_item_id=NEW.work_item_id AND revision.action='submit'
      AND revision.actor_account_id=NEW.submitted_by_account_id AND revision.recorded_at=NEW.created_at
      AND attachment.id=NEW.attachment_id AND attachment.owner_account_id=NEW.submitted_by_account_id
      AND attachment.status='pending' AND attachment.linked_at IS NULL AND attachment.erased_at IS NULL
      AND attachment.wrapped_dek IS NOT NULL AND attachment.plaintext_sha256=NEW.plaintext_sha256
      AND json_extract(evidence.value,'$.sha256')=NEW.plaintext_sha256 AND attachment.created_at<=NEW.created_at
  );
END;

CREATE TRIGGER system_work_evidence_update BEFORE UPDATE ON system_work_evidence
BEGIN
  SELECT RAISE(ABORT, 'work item records are immutable');
END;

CREATE TRIGGER system_work_item_revisions_delete BEFORE DELETE ON system_work_item_revisions
BEGIN
  SELECT RAISE(ABORT, 'work item records are immutable');
END;

CREATE TRIGGER system_work_item_revisions_identity_update
BEFORE UPDATE OF id ON system_work_item_revisions
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

CREATE TRIGGER system_work_item_revisions_update BEFORE UPDATE ON system_work_item_revisions
BEGIN
  SELECT RAISE(ABORT, 'work item records are immutable');
END;

CREATE TRIGGER system_work_items_delete BEFORE DELETE ON system_work_items
BEGIN
  SELECT RAISE(ABORT, 'work item records are immutable');
END;

CREATE TRIGGER system_work_items_update BEFORE UPDATE ON system_work_items
BEGIN
  SELECT RAISE(ABORT, 'work item records are immutable');
END;

CREATE TRIGGER system_work_revision_insert BEFORE INSERT ON system_work_item_revisions
BEGIN
  SELECT RAISE(ABORT, 'work_item_shape_invalid')
  WHERE NOT COALESCE((
    (SELECT count(*) FROM json_each(NEW.snapshot_json)) = 23
    AND NOT EXISTS (SELECT 1 FROM json_each(NEW.snapshot_json) WHERE key NOT IN ('id','revision','commandId','requestDigest','action','title','instructions','acceptanceCriteria','dueAt','previousRevisionId','createdBy','createdAt','assignee','accountable','state','result','handover','actor','authentication','recovery','reason','recordedAt','auditEventId'))
    AND json_extract(NEW.snapshot_json, '$.id') IS NEW.work_item_id
    AND json_extract(NEW.snapshot_json, '$.revision') IS NEW.revision
    AND json_extract(NEW.snapshot_json, '$.commandId') IS NEW.command_id
    AND json_extract(NEW.snapshot_json, '$.action') IS NEW.action
    AND json_extract(NEW.snapshot_json, '$.state') IS NEW.state
    AND json_extract(NEW.snapshot_json, '$.actor.accountId') IS NEW.actor_account_id
    AND json_extract(NEW.snapshot_json, '$.actor.principalId') IS NEW.actor_principal_id
    AND json_extract(NEW.snapshot_json, '$.accountable.accountId') IS NEW.accountable_account_id
    AND json_extract(NEW.snapshot_json, '$.accountable.principalId') IS NEW.accountable_principal_id
    AND json_extract(NEW.snapshot_json, '$.assignee.accountId') IS NEW.assignee_account_id
    AND json_extract(NEW.snapshot_json, '$.assignee.principalId') IS NEW.assignee_principal_id
    AND json_extract(NEW.snapshot_json, '$.auditEventId') IS NEW.audit_event_id
    AND json_extract(NEW.snapshot_json, '$.recordedAt') IS strftime('%Y-%m-%dT%H:%M:%fZ', NEW.recorded_at / 1000.0, 'unixepoch')
    AND json_type(NEW.snapshot_json, '$.requestDigest') IS 'text' AND length(json_extract(NEW.snapshot_json, '$.requestDigest')) = 64 AND json_extract(NEW.snapshot_json, '$.requestDigest') NOT GLOB '*[^0-9a-f]*'
    AND json_type(NEW.snapshot_json, '$.recovery') IN ('true','false')
    AND json_type(NEW.snapshot_json, '$.reason') IS 'text' AND length(trim(json_extract(NEW.snapshot_json, '$.reason'))) BETWEEN 1 AND 1000
    AND json_type(NEW.snapshot_json, '$.authentication') IS 'object' AND (SELECT count(*) FROM json_each(NEW.snapshot_json, '$.authentication')) = 3
    AND json_type(NEW.snapshot_json, '$.authentication.tokenVersion') IS 'integer' AND json_extract(NEW.snapshot_json, '$.authentication.tokenVersion') BETWEEN 0 AND 9007199254740991
    AND (json_type(NEW.snapshot_json, '$.authentication.credentialId') IS 'null' OR (json_type(NEW.snapshot_json, '$.authentication.credentialId') IS 'text' AND length(json_extract(NEW.snapshot_json, '$.authentication.credentialId')) BETWEEN 1 AND 255))
    AND (json_type(NEW.snapshot_json, '$.authentication.stepUpGrantId') IS 'null' OR (json_type(NEW.snapshot_json, '$.authentication.stepUpGrantId') IS 'text' AND length(json_extract(NEW.snapshot_json, '$.authentication.stepUpGrantId')) BETWEEN 1 AND 255))
    AND json_type(NEW.snapshot_json, '$.createdBy') IS 'object' AND (SELECT count(*) FROM json_each(NEW.snapshot_json, '$.createdBy')) = 3
    AND json_type(NEW.snapshot_json, '$.createdBy.kind') IS 'text' AND json_extract(NEW.snapshot_json, '$.createdBy.kind') IN ('human')
    AND json_type(NEW.snapshot_json, '$.createdBy.accountId') IS 'text' AND length(trim(json_extract(NEW.snapshot_json, '$.createdBy.accountId'))) BETWEEN 1 AND 255
    AND json_type(NEW.snapshot_json, '$.createdBy.principalId') IS 'text' AND length(trim(json_extract(NEW.snapshot_json, '$.createdBy.principalId'))) BETWEEN 1 AND 255
    AND json_type(NEW.snapshot_json, '$.actor') IS 'object' AND (SELECT count(*) FROM json_each(NEW.snapshot_json, '$.actor')) = 3
    AND json_type(NEW.snapshot_json, '$.actor.kind') IS 'text' AND json_extract(NEW.snapshot_json, '$.actor.kind') IN ('human','agent')
    AND json_type(NEW.snapshot_json, '$.actor.accountId') IS 'text' AND length(trim(json_extract(NEW.snapshot_json, '$.actor.accountId'))) BETWEEN 1 AND 255
    AND json_type(NEW.snapshot_json, '$.actor.principalId') IS 'text' AND length(trim(json_extract(NEW.snapshot_json, '$.actor.principalId'))) BETWEEN 1 AND 255
    AND json_type(NEW.snapshot_json, '$.assignee') IS 'object' AND (SELECT count(*) FROM json_each(NEW.snapshot_json, '$.assignee')) = 3
    AND json_type(NEW.snapshot_json, '$.assignee.kind') IS 'text' AND json_extract(NEW.snapshot_json, '$.assignee.kind') IN ('human','agent')
    AND json_type(NEW.snapshot_json, '$.assignee.accountId') IS 'text' AND length(trim(json_extract(NEW.snapshot_json, '$.assignee.accountId'))) BETWEEN 1 AND 255
    AND json_type(NEW.snapshot_json, '$.assignee.principalId') IS 'text' AND length(trim(json_extract(NEW.snapshot_json, '$.assignee.principalId'))) BETWEEN 1 AND 255
    AND json_type(NEW.snapshot_json, '$.accountable') IS 'object' AND (SELECT count(*) FROM json_each(NEW.snapshot_json, '$.accountable')) = 3
    AND json_type(NEW.snapshot_json, '$.accountable.kind') IS 'text' AND json_extract(NEW.snapshot_json, '$.accountable.kind') IN ('human')
    AND json_type(NEW.snapshot_json, '$.accountable.accountId') IS 'text' AND length(trim(json_extract(NEW.snapshot_json, '$.accountable.accountId'))) BETWEEN 1 AND 255
    AND json_type(NEW.snapshot_json, '$.accountable.principalId') IS 'text' AND length(trim(json_extract(NEW.snapshot_json, '$.accountable.principalId'))) BETWEEN 1 AND 255
    AND (json_type(NEW.snapshot_json, '$.result') IS 'null' OR (
    json_type(NEW.snapshot_json, '$.result') IS 'object'
    AND (SELECT count(*) FROM json_each(NEW.snapshot_json, '$.result')) = 6
    AND json_type(NEW.snapshot_json, '$.result.id') IS 'text'
    AND json_type(NEW.snapshot_json, '$.result.summary') IS 'text'
    AND length(trim(json_extract(NEW.snapshot_json, '$.result.summary'))) BETWEEN 1 AND 10000
    AND json_type(NEW.snapshot_json, '$.result.digest') IS 'text'
    AND length(json_extract(NEW.snapshot_json, '$.result.digest')) = 64
    AND json_extract(NEW.snapshot_json, '$.result.digest') NOT GLOB '*[^0-9a-f]*'
    AND json_type(NEW.snapshot_json, '$.result.evidence') IS 'array'
    AND json_array_length(NEW.snapshot_json, '$.result.evidence') <= 20
    AND (SELECT count(*) FROM json_each(NEW.snapshot_json, '$.result.evidence')) = (SELECT count(DISTINCT json_extract(value, '$.attachmentId')) FROM json_each(NEW.snapshot_json, '$.result.evidence'))
    AND NOT EXISTS (SELECT 1 FROM json_each(NEW.snapshot_json, '$.result.evidence') evidence
      WHERE evidence.type <> 'object' OR (SELECT count(*) FROM json_each(evidence.value)) <> 2
        OR json_type(evidence.value, '$.attachmentId') IS NOT 'text'
        OR length(trim(json_extract(evidence.value, '$.attachmentId'))) NOT BETWEEN 1 AND 64
        OR json_type(evidence.value, '$.sha256') IS NOT 'text'
        OR length(json_extract(evidence.value, '$.sha256')) <> 64
        OR json_extract(evidence.value, '$.sha256') GLOB '*[^0-9a-f]*')
    AND json_extract(NEW.snapshot_json, '$.result.submittedBy') IS json_extract(NEW.snapshot_json, '$.assignee')
    AND json_type(NEW.snapshot_json, '$.result.submittedAt') IS 'text'
    AND json_extract(NEW.snapshot_json, '$.result.submittedAt') >= json_extract(NEW.snapshot_json, '$.createdAt')
    AND json_extract(NEW.snapshot_json, '$.result.submittedAt') <= json_extract(NEW.snapshot_json, '$.recordedAt')
  ))
    AND (json_type(NEW.snapshot_json, '$.handover') IS 'null' OR (
    json_type(NEW.snapshot_json, '$.handover') IS 'object'
    AND (SELECT count(*) FROM json_each(NEW.snapshot_json, '$.handover')) = 5
    AND json_type(NEW.snapshot_json, '$.handover.id') IS 'text'
    AND json_type(NEW.snapshot_json, '$.handover.reason') IS 'text'
    AND length(trim(json_extract(NEW.snapshot_json, '$.handover.reason'))) BETWEEN 1 AND 1000
    AND json_type(NEW.snapshot_json, '$.handover.requestedAt') IS 'text'
    AND json_extract(NEW.snapshot_json, '$.handover.requestedAt') >= json_extract(NEW.snapshot_json, '$.createdAt')
    AND json_extract(NEW.snapshot_json, '$.handover.requestedAt') <= json_extract(NEW.snapshot_json, '$.recordedAt')
    AND json_type(NEW.snapshot_json, '$.handover.to') IS 'object'
    AND (SELECT count(*) FROM json_each(NEW.snapshot_json, '$.handover.to'))=3
    AND json_extract(NEW.snapshot_json, '$.handover.to.kind') IS 'human'
    AND json_extract(NEW.snapshot_json, '$.handover.requestedBy.kind') IS 'human'
    AND json_extract(NEW.snapshot_json, '$.handover.to') IS NOT json_extract(NEW.snapshot_json, '$.accountable')
  ))
  ), 0);
  SELECT RAISE(ABORT, 'work_item_revision_conflict')
  WHERE NOT COALESCE((
    NEW.revision = 1 + COALESCE((SELECT max(revision) FROM system_work_item_revisions WHERE work_item_id=NEW.work_item_id),0)
    AND NEW.recorded_at >= COALESCE((SELECT max(recorded_at) FROM system_work_item_revisions WHERE work_item_id=NEW.work_item_id),0)
  ), 0);
  SELECT RAISE(ABORT, 'work_item_definition_changed')
  WHERE NOT COALESCE((
    EXISTS (SELECT 1 FROM system_work_items item WHERE item.id=NEW.work_item_id AND json_extract(NEW.snapshot_json, '$.title') IS item.title AND json_extract(NEW.snapshot_json, '$.instructions') IS item.instructions AND json_extract(NEW.snapshot_json, '$.acceptanceCriteria') IS item.acceptance_criteria AND json_extract(NEW.snapshot_json, '$.createdBy.accountId') IS item.created_by_account_id AND json_extract(NEW.snapshot_json, '$.createdBy.principalId') IS item.created_by_principal_id AND json_extract(NEW.snapshot_json, '$.previousRevisionId') IS item.previous_revision_id AND json_extract(NEW.snapshot_json, '$.createdAt') IS strftime('%Y-%m-%dT%H:%M:%fZ', item.created_at / 1000.0, 'unixepoch') AND json_extract(NEW.snapshot_json, '$.dueAt') IS strftime('%Y-%m-%dT%H:%M:%fZ', item.due_at / 1000.0, 'unixepoch') AND item.created_at <= NEW.recorded_at)
  ), 0);
  SELECT RAISE(ABORT, 'work_item_actor_unavailable') WHERE NOT EXISTS (
    SELECT 1 FROM system_accounts account JOIN system_principals principal ON principal.account_id=account.id
    WHERE account.id=NEW.actor_account_id AND principal.id=NEW.actor_principal_id
      AND principal.kind=json_extract(NEW.snapshot_json,'$.actor.kind') AND principal.kind IN ('human','agent')
      AND account.status='active' AND account.closed_at IS NULL AND account.created_at<=NEW.recorded_at
      AND principal.created_at<=NEW.recorded_at AND account.token_version=json_extract(NEW.snapshot_json,'$.authentication.tokenVersion')
      AND ((principal.kind='human' AND json_type(NEW.snapshot_json,'$.authentication.credentialId') IS 'null')
        OR (principal.kind='agent' AND json_type(NEW.snapshot_json,'$.authentication.stepUpGrantId') IS 'null' AND EXISTS (
          SELECT 1 FROM system_machine_credentials credential
          WHERE credential.id=json_extract(NEW.snapshot_json,'$.authentication.credentialId') AND credential.principal_id=principal.id
            AND credential.status='active' AND credential.revoked_at IS NULL AND credential.created_at<=NEW.recorded_at
            AND (credential.expires_at IS NULL OR NEW.recorded_at<credential.expires_at))))
      AND (NEW.action IN ('create','accept','submit') OR (principal.kind='human' AND EXISTS (
        SELECT 1 FROM system_step_up_grants grant WHERE grant.id=json_extract(NEW.snapshot_json,'$.authentication.stepUpGrantId')
          AND grant.account_id=account.id AND grant.issued_at<=NEW.recorded_at AND NEW.recorded_at<grant.expires_at
          AND grant.revoked_at IS NULL AND grant.last_used_at<=NEW.recorded_at)))
  );
  SELECT RAISE(ABORT, 'work_item_permission_denied')
  WHERE NOT COALESCE((
    (EXISTS (SELECT 1 FROM (SELECT permission.permission_key FROM system_role_bindings binding
    JOIN system_iam_roles role ON role.id=binding.role_id
    JOIN system_iam_role_permissions permission ON permission.role_id=role.id
    WHERE binding.account_id=NEW.actor_account_id AND binding.resource_type IS NULL AND binding.resource_id IS NULL
      AND role.resource_type IS NULL AND role.created_at<=NEW.recorded_at AND binding.created_at<=NEW.recorded_at
      AND (binding.revoked_at IS NULL OR NEW.recorded_at<binding.revoked_at)) grants WHERE permission_key='system:admin') OR (EXISTS (SELECT 1 FROM (SELECT permission.permission_key FROM system_role_bindings binding
    JOIN system_iam_roles role ON role.id=binding.role_id
    JOIN system_iam_role_permissions permission ON permission.role_id=role.id
    WHERE binding.account_id=NEW.actor_account_id AND binding.resource_type IS NULL AND binding.resource_id IS NULL
      AND role.resource_type IS NULL AND role.created_at<=NEW.recorded_at AND binding.created_at<=NEW.recorded_at
      AND (binding.revoked_at IS NULL OR NEW.recorded_at<binding.revoked_at)) grants WHERE permission_key='system:work:read') AND EXISTS (SELECT 1 FROM (SELECT permission.permission_key FROM system_role_bindings binding
    JOIN system_iam_roles role ON role.id=binding.role_id
    JOIN system_iam_role_permissions permission ON permission.role_id=role.id
    WHERE binding.account_id=NEW.actor_account_id AND binding.resource_type IS NULL AND binding.resource_id IS NULL
      AND role.resource_type IS NULL AND role.created_at<=NEW.recorded_at AND binding.created_at<=NEW.recorded_at
      AND (binding.revoked_at IS NULL OR NEW.recorded_at<binding.revoked_at)) grants WHERE
      (NEW.action='create' AND permission_key='system:work:create')
      OR (NEW.action IN ('accept','submit') AND permission_key='system:work:perform')
      OR (NEW.action IN ('approve','return') AND permission_key='system:work:review')
      OR (NEW.action IN ('request_handover','accept_handover','decline_handover','cancel') AND permission_key='system:work:manage'))))
    AND (json_extract(NEW.snapshot_json, '$.recovery')=0 OR (NEW.action='request_handover' AND EXISTS (SELECT 1 FROM (SELECT permission.permission_key FROM system_role_bindings binding
    JOIN system_iam_roles role ON role.id=binding.role_id
    JOIN system_iam_role_permissions permission ON permission.role_id=role.id
    WHERE binding.account_id=NEW.actor_account_id AND binding.resource_type IS NULL AND binding.resource_id IS NULL
      AND role.resource_type IS NULL AND role.created_at<=NEW.recorded_at AND binding.created_at<=NEW.recorded_at
      AND (binding.revoked_at IS NULL OR NEW.recorded_at<binding.revoked_at)) grants WHERE permission_key='system:admin')))
  ), 0);
  SELECT RAISE(ABORT, 'work_item_transition_invalid')
  WHERE NOT COALESCE((
    (NEW.revision=1 AND NEW.action='create' AND NEW.state='offered' AND json_type(NEW.snapshot_json, '$.result') IS 'null' AND json_type(NEW.snapshot_json, '$.handover') IS 'null' AND json_extract(NEW.snapshot_json, '$.actor') IS json_extract(NEW.snapshot_json, '$.createdBy') AND json_extract(NEW.snapshot_json, '$.actor') IS json_extract(NEW.snapshot_json, '$.accountable') AND json_extract(NEW.snapshot_json, '$.createdAt') IS json_extract(NEW.snapshot_json, '$.recordedAt')) OR (NEW.revision>1 AND EXISTS (SELECT 1 FROM system_work_item_revisions previous WHERE previous.work_item_id=NEW.work_item_id AND previous.revision=NEW.revision-1 AND previous.state NOT IN ('completed','cancelled') AND json_extract(NEW.snapshot_json, '$.assignee') IS json_extract(previous.snapshot_json, '$.assignee') AND (json_type(previous.snapshot_json, '$.handover') IS 'null' OR NEW.action IN ('accept_handover','decline_handover','cancel') OR (NEW.action='request_handover' AND json_extract(NEW.snapshot_json, '$.recovery')=1)) AND (NEW.action='submit' OR json_extract(NEW.snapshot_json, '$.result') IS json_extract(previous.snapshot_json, '$.result')) AND (NEW.action='accept_handover' OR json_extract(NEW.snapshot_json, '$.accountable') IS json_extract(previous.snapshot_json, '$.accountable')) AND (NEW.action='request_handover' OR json_type(NEW.snapshot_json, '$.handover') IS 'null') AND (
      (NEW.action='accept' AND previous.state='offered' AND NEW.state='active' AND json_extract(NEW.snapshot_json, '$.actor') IS json_extract(previous.snapshot_json, '$.assignee'))
      OR (NEW.action='submit' AND previous.state='active' AND NEW.state='review_pending' AND json_extract(NEW.snapshot_json, '$.actor') IS json_extract(previous.snapshot_json, '$.assignee') AND json_type(NEW.snapshot_json, '$.result') IS 'object' AND json_extract(NEW.snapshot_json, '$.result.id') IS NEW.command_id AND json_extract(NEW.snapshot_json, '$.result.submittedAt') IS json_extract(NEW.snapshot_json, '$.recordedAt'))
      OR (NEW.action='approve' AND previous.state='review_pending' AND NEW.state='completed' AND json_extract(NEW.snapshot_json, '$.actor') IS json_extract(previous.snapshot_json, '$.accountable') AND json_type(NEW.snapshot_json, '$.result') IS 'object' AND NEW.actor_account_id<>NEW.assignee_account_id AND NEW.actor_principal_id<>NEW.assignee_principal_id)
      OR (NEW.action='return' AND previous.state='review_pending' AND NEW.state='active' AND json_extract(NEW.snapshot_json, '$.actor') IS json_extract(previous.snapshot_json, '$.accountable') AND json_type(NEW.snapshot_json, '$.result') IS 'object')
      OR (NEW.action='request_handover' AND NEW.state=previous.state AND (json_extract(NEW.snapshot_json, '$.actor') IS json_extract(previous.snapshot_json, '$.accountable') OR json_extract(NEW.snapshot_json, '$.recovery')=1) AND json_extract(NEW.snapshot_json, '$.recovery') IS (json_type(previous.snapshot_json, '$.handover') IS 'object' OR json_extract(NEW.snapshot_json, '$.actor') IS NOT json_extract(previous.snapshot_json, '$.accountable')) AND json_type(NEW.snapshot_json, '$.handover') IS 'object' AND json_extract(NEW.snapshot_json, '$.handover.id') IS NEW.command_id AND json_extract(NEW.snapshot_json, '$.handover.requestedAt') IS json_extract(NEW.snapshot_json, '$.recordedAt') AND json_extract(NEW.snapshot_json, '$.handover.requestedBy') IS json_extract(NEW.snapshot_json, '$.actor') AND json_extract(NEW.snapshot_json, '$.handover.reason') IS json_extract(NEW.snapshot_json, '$.reason'))
      OR (NEW.action='accept_handover' AND NEW.state=previous.state AND json_type(previous.snapshot_json, '$.handover') IS 'object' AND json_extract(NEW.snapshot_json, '$.actor') IS json_extract(previous.snapshot_json, '$.handover.to') AND json_extract(NEW.snapshot_json, '$.accountable') IS json_extract(previous.snapshot_json, '$.handover.to'))
      OR (NEW.action='decline_handover' AND NEW.state=previous.state AND json_type(previous.snapshot_json, '$.handover') IS 'object' AND json_extract(NEW.snapshot_json, '$.actor') IS json_extract(previous.snapshot_json, '$.handover.to'))
      OR (NEW.action='cancel' AND NEW.state='cancelled' AND json_extract(NEW.snapshot_json, '$.actor') IS json_extract(previous.snapshot_json, '$.accountable')))))
  ), 0);
  SELECT RAISE(ABORT, 'work_item_recipient_unavailable')
  WHERE NOT COALESCE((
    NOT (NEW.action='create') OR EXISTS (SELECT 1 FROM system_accounts account JOIN system_principals principal ON principal.account_id=account.id WHERE account.id=json_extract(NEW.snapshot_json, '$.assignee.accountId') AND principal.id=json_extract(NEW.snapshot_json, '$.assignee.principalId') AND principal.kind=json_extract(NEW.snapshot_json, '$.assignee.kind') AND principal.kind IN ('human','agent') AND account.status='active' AND account.closed_at IS NULL AND account.created_at<=NEW.recorded_at AND principal.created_at<=NEW.recorded_at)
  ), 0);
  SELECT RAISE(ABORT, 'work_item_recipient_unavailable')
  WHERE NOT COALESCE((
    NOT (NEW.action='request_handover') OR EXISTS (SELECT 1 FROM system_accounts account JOIN system_principals principal ON principal.account_id=account.id WHERE account.id=json_extract(NEW.snapshot_json, '$.handover.to.accountId') AND principal.id=json_extract(NEW.snapshot_json, '$.handover.to.principalId') AND principal.kind=json_extract(NEW.snapshot_json, '$.handover.to.kind') AND principal.kind = 'human' AND account.status='active' AND account.closed_at IS NULL AND account.created_at<=NEW.recorded_at AND principal.created_at<=NEW.recorded_at)
  ), 0);
  SELECT RAISE(ABORT, 'work_item_previous_unavailable')
  WHERE NOT COALESCE((
    NEW.action<>'create' OR json_type(NEW.snapshot_json, '$.previousRevisionId') IS 'null' OR EXISTS (SELECT 1 FROM system_work_item_revisions prior WHERE prior.command_id=json_extract(NEW.snapshot_json, '$.previousRevisionId') AND prior.state IN ('completed','cancelled') AND prior.work_item_id<>NEW.work_item_id AND prior.recorded_at<=NEW.recorded_at AND (prior.accountable_account_id=NEW.actor_account_id AND prior.accountable_principal_id=NEW.actor_principal_id OR prior.assignee_account_id=NEW.actor_account_id AND prior.assignee_principal_id=NEW.actor_principal_id OR EXISTS (SELECT 1 FROM (SELECT permission.permission_key FROM system_role_bindings binding
    JOIN system_iam_roles role ON role.id=binding.role_id
    JOIN system_iam_role_permissions permission ON permission.role_id=role.id
    WHERE binding.account_id=NEW.actor_account_id AND binding.resource_type IS NULL AND binding.resource_id IS NULL
      AND role.resource_type IS NULL AND role.created_at<=NEW.recorded_at AND binding.created_at<=NEW.recorded_at
      AND (binding.revoked_at IS NULL OR NEW.recorded_at<binding.revoked_at)) grants WHERE permission_key='system:admin')))
  ), 0);
  SELECT RAISE(ABORT, 'work_item_audit_invalid')
  WHERE NOT COALESCE((
    EXISTS (SELECT 1 FROM system_audit_events audit WHERE audit.event_id=NEW.audit_event_id
    AND audit.actor_account_id=NEW.actor_account_id AND audit.action='system.work.'||NEW.action
    AND audit.target_type='system:work-item' AND audit.target_id=NEW.work_item_id
    AND audit.outcome='succeeded' AND audit.reason_code IS NULL AND audit.metadata_json IS NULL
    AND audit.occurred_at=NEW.recorded_at AND audit.after_json IS NEW.snapshot_json
    AND audit.before_json IS (SELECT snapshot_json FROM system_work_item_revisions WHERE work_item_id=NEW.work_item_id AND revision=NEW.revision-1)
    AND json_extract(audit.authorization_json,'$.principal_id') IS NEW.actor_principal_id
    AND json_extract(audit.authorization_json,'$.principal_kind') IS json_extract(NEW.snapshot_json, '$.actor.kind')
    AND json_extract(audit.authorization_json,'$.token_version') IS json_extract(NEW.snapshot_json, '$.authentication.tokenVersion')
    AND json_extract(audit.authorization_json,'$.credential_id') IS json_extract(NEW.snapshot_json, '$.authentication.credentialId')
    AND json_extract(audit.authorization_json,'$.step_up_grant_id') IS json_extract(NEW.snapshot_json, '$.authentication.stepUpGrantId')
    AND json_extract(audit.authorization_json,'$.recovery') IS json_extract(NEW.snapshot_json, '$.recovery'))
  ), 0);
  SELECT RAISE(ABORT, 'work_item_evidence_unavailable')
  WHERE NOT COALESCE((
    NEW.action NOT IN ('submit','approve') OR NOT EXISTS (
    SELECT 1 FROM json_each(NEW.snapshot_json,'$.result.evidence') evidence WHERE NOT EXISTS (
      SELECT 1 FROM system_attachments attachment WHERE attachment.id=json_extract(evidence.value,'$.attachmentId')
        AND attachment.plaintext_sha256=json_extract(evidence.value,'$.sha256') AND attachment.erased_at IS NULL
        AND attachment.wrapped_dek IS NOT NULL AND attachment.created_at<=NEW.recorded_at
        AND ((NEW.action='submit' AND attachment.owner_account_id=NEW.actor_account_id
          AND attachment.status='pending' AND attachment.linked_at IS NULL
          AND NOT EXISTS (SELECT 1 FROM system_work_evidence claim WHERE claim.attachment_id=attachment.id))
        OR (attachment.status='linked' AND attachment.linked_at IS NOT NULL AND EXISTS (
          SELECT 1 FROM system_work_evidence claim WHERE claim.attachment_id=attachment.id
            AND claim.work_item_id=NEW.work_item_id AND claim.plaintext_sha256=attachment.plaintext_sha256)))))
  ), 0);
END;

CREATE TRIGGER system_work_submit_evidence AFTER INSERT ON system_work_item_revisions
WHEN NEW.action='submit'
BEGIN
  INSERT INTO system_work_evidence (attachment_id,work_item_id,plaintext_sha256,submitted_by_account_id,command_id,created_at)
  SELECT json_extract(evidence.value,'$.attachmentId'),NEW.work_item_id,json_extract(evidence.value,'$.sha256'),
    NEW.actor_account_id,NEW.command_id,NEW.recorded_at
  FROM json_each(NEW.snapshot_json,'$.result.evidence') evidence
  WHERE NOT EXISTS (SELECT 1 FROM system_work_evidence claim WHERE claim.attachment_id=json_extract(evidence.value,'$.attachmentId'));
  UPDATE system_attachments SET status='linked',linked_at=NEW.recorded_at
  WHERE id IN (SELECT attachment_id FROM system_work_evidence WHERE command_id=NEW.command_id)
    AND status='pending' AND linked_at IS NULL AND erased_at IS NULL;
  SELECT RAISE(ABORT, 'work_item_evidence_unavailable') WHERE EXISTS (
    SELECT 1 FROM json_each(NEW.snapshot_json,'$.result.evidence') evidence WHERE NOT EXISTS (
      SELECT 1 FROM system_work_evidence claim JOIN system_attachments attachment ON attachment.id=claim.attachment_id
      WHERE claim.attachment_id=json_extract(evidence.value,'$.attachmentId') AND claim.work_item_id=NEW.work_item_id
        AND claim.plaintext_sha256=json_extract(evidence.value,'$.sha256')
        AND attachment.plaintext_sha256=claim.plaintext_sha256 AND attachment.status='linked'
        AND attachment.linked_at IS NOT NULL AND attachment.erased_at IS NULL AND attachment.wrapped_dek IS NOT NULL));
END;
