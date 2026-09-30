ALTER TABLE software_licenses ADD COLUMN plan_name TEXT;
ALTER TABLE software_licenses ADD COLUMN revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0);
CREATE TABLE software_license_changes (
  id TEXT PRIMARY KEY NOT NULL,
  license_id INTEGER NOT NULL REFERENCES software_licenses(id) ON DELETE RESTRICT,
  actor_account_id TEXT NOT NULL REFERENCES system_accounts(id) ON DELETE RESTRICT,
  recorded_at INTEGER NOT NULL CHECK (recorded_at >= 0),
  command_id TEXT,
  request_json TEXT CHECK (request_json IS NULL OR json_valid(request_json)),
  before_json TEXT CHECK (before_json IS NULL OR json_valid(before_json)),
  after_json TEXT NOT NULL CHECK (json_valid(after_json)),
  UNIQUE (actor_account_id, command_id),
  CHECK ((command_id IS NULL AND request_json IS NULL) OR (command_id IS NOT NULL AND request_json IS NOT NULL))
);
CREATE INDEX software_license_change_history ON software_license_changes(license_id, recorded_at, id);
CREATE TRIGGER software_license_changes_update BEFORE UPDATE ON software_license_changes
BEGIN SELECT RAISE(ABORT, 'software_license_history_immutable'); END;
CREATE TRIGGER software_license_changes_delete BEFORE DELETE ON software_license_changes
BEGIN SELECT RAISE(ABORT, 'software_license_history_immutable'); END;
CREATE TABLE software_license_assignments (
  id TEXT PRIMARY KEY NOT NULL,
  license_id INTEGER NOT NULL REFERENCES software_licenses(id) ON DELETE RESTRICT,
  employee_id TEXT NOT NULL REFERENCES company_employees(id) ON DELETE RESTRICT,
  service_name TEXT NOT NULL CHECK (length(trim(service_name)) > 0),
  plan_name TEXT,
  account_reference TEXT,
  assigned_at INTEGER NOT NULL CHECK (assigned_at >= 0),
  assigned_by TEXT NOT NULL REFERENCES system_accounts(id) ON DELETE RESTRICT,
  assigned_reason TEXT NOT NULL CHECK (length(trim(assigned_reason)) > 0),
  released_at INTEGER,
  released_by TEXT REFERENCES system_accounts(id) ON DELETE RESTRICT,
  release_reason TEXT,
  CHECK ((released_at IS NULL AND released_by IS NULL AND release_reason IS NULL)
    OR (released_at IS NOT NULL AND released_at >= assigned_at AND released_by IS NOT NULL
      AND release_reason IS NOT NULL AND length(trim(release_reason)) > 0))
);
CREATE UNIQUE INDEX software_license_active_employee ON software_license_assignments(license_id, employee_id) WHERE released_at IS NULL;
CREATE UNIQUE INDEX software_license_active_account ON software_license_assignments(license_id, account_reference) WHERE released_at IS NULL AND account_reference IS NOT NULL;
CREATE INDEX software_license_employee_history ON software_license_assignments(employee_id, assigned_at, id);
CREATE TRIGGER software_license_assignment_capacity BEFORE INSERT ON software_license_assignments
BEGIN
  SELECT RAISE(ABORT, 'software_license_capacity_conflict') WHERE NEW.released_at IS NOT NULL OR NOT EXISTS (
    SELECT 1 FROM software_licenses license WHERE license.id = NEW.license_id AND license.status = 'active'
      AND (license.seats IS NULL OR license.seats > (
        SELECT count(*) FROM software_license_assignments WHERE license_id = NEW.license_id AND released_at IS NULL
      ))
  );
END;
CREATE TRIGGER software_license_assignment_history_update BEFORE UPDATE ON software_license_assignments
WHEN OLD.released_at IS NOT NULL OR NEW.released_at IS NULL
  OR NEW.id IS NOT OLD.id OR NEW.license_id IS NOT OLD.license_id OR NEW.employee_id IS NOT OLD.employee_id
  OR NEW.service_name IS NOT OLD.service_name OR NEW.plan_name IS NOT OLD.plan_name
  OR NEW.account_reference IS NOT OLD.account_reference OR NEW.assigned_at IS NOT OLD.assigned_at
  OR NEW.assigned_by IS NOT OLD.assigned_by OR NEW.assigned_reason IS NOT OLD.assigned_reason
BEGIN SELECT RAISE(ABORT, 'software_license_history_immutable'); END;
CREATE TRIGGER software_license_assignment_history_delete BEFORE DELETE ON software_license_assignments
BEGIN SELECT RAISE(ABORT, 'software_license_history_immutable'); END;
CREATE TRIGGER software_license_active_assignments_guard BEFORE UPDATE ON software_licenses
WHEN (NEW.status <> 'active' AND EXISTS (SELECT 1 FROM software_license_assignments WHERE license_id = OLD.id AND released_at IS NULL))
  OR (NEW.seats IS NOT NULL AND NEW.seats < (SELECT count(*) FROM software_license_assignments WHERE license_id = OLD.id AND released_at IS NULL))
BEGIN SELECT RAISE(ABORT, 'software_license_capacity_conflict'); END;
