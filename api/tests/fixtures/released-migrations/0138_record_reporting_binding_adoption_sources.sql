CREATE TABLE _company_reporting_bindings_with_adoptions (
  resource_id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL DEFAULT 'organization:default' CHECK (organization_id = 'organization:default'),
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
    REFERENCES company_resource_heads(organization_id, resource_type, resource_id) ON DELETE RESTRICT
);

INSERT INTO _company_reporting_bindings_with_adoptions (rowid, resource_id, organization_id, resource_type, employee_id, employment_id, organization_unit_id, assignment_type, recorded_by_action_id)
SELECT rowid, resource_id, organization_id, resource_type, employee_id, employment_id, organization_unit_id, assignment_type, recorded_by_action_id FROM company_personnel_reporting_bindings;
CREATE TABLE _company_reporting_binding_copy_check (ok INTEGER NOT NULL CHECK (ok = 1));
INSERT INTO _company_reporting_binding_copy_check (ok)
SELECT NOT EXISTS (
  SELECT rowid, resource_id, organization_id, resource_type, employee_id, employment_id, organization_unit_id, assignment_type, recorded_by_action_id FROM company_personnel_reporting_bindings
  EXCEPT SELECT rowid, resource_id, organization_id, resource_type, employee_id, employment_id, organization_unit_id, assignment_type, recorded_by_action_id FROM _company_reporting_bindings_with_adoptions
) AND NOT EXISTS (
  SELECT rowid, resource_id, organization_id, resource_type, employee_id, employment_id, organization_unit_id, assignment_type, recorded_by_action_id FROM _company_reporting_bindings_with_adoptions
  EXCEPT SELECT rowid, resource_id, organization_id, resource_type, employee_id, employment_id, organization_unit_id, assignment_type, recorded_by_action_id FROM company_personnel_reporting_bindings
);
DROP TRIGGER IF EXISTS company_personnel_reporting_binding_update_guard;
DROP TRIGGER IF EXISTS company_personnel_reporting_binding_delete_guard;
DROP TRIGGER IF EXISTS company_personnel_reporting_binding_insert_guard;
DROP TRIGGER IF EXISTS company_personnel_reporting_coverage_insert_guard;
DROP TRIGGER IF EXISTS company_personnel_reporting_owner_guard;
DROP TRIGGER IF EXISTS company_personnel_reporting_commit_guard;
DROP TRIGGER IF EXISTS company_personnel_reporting_completion_guard;
DROP VIEW company_personnel_reporting_periods;
DROP TABLE company_personnel_reporting_bindings;
ALTER TABLE _company_reporting_bindings_with_adoptions RENAME TO company_personnel_reporting_bindings;
DROP TABLE _company_reporting_binding_copy_check;
