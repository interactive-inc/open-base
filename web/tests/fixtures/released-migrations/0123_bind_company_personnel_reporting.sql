CREATE TABLE company_personnel_reporting_bindings (
  resource_id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL DEFAULT 'organization:default' CHECK (organization_id = 'organization:default'),
  resource_type TEXT NOT NULL DEFAULT 'reporting-relation' CHECK (resource_type = 'reporting-relation'),
  employee_id TEXT NOT NULL REFERENCES company_employees(id) ON DELETE RESTRICT,
  employment_id TEXT NOT NULL REFERENCES company_employments(id) ON DELETE RESTRICT,
  organization_unit_id TEXT NOT NULL REFERENCES company_organization_units(id) ON DELETE RESTRICT,
  assignment_type TEXT NOT NULL CHECK (assignment_type IN ('PRIMARY', 'CONCURRENT')),
  recorded_by_action_id TEXT NOT NULL REFERENCES company_personnel_actions(id) ON DELETE RESTRICT,
  UNIQUE (employee_id, employment_id, organization_unit_id, assignment_type),
  FOREIGN KEY (organization_id, resource_type, resource_id)
    REFERENCES company_resource_heads(organization_id, resource_type, resource_id) ON DELETE RESTRICT
);
