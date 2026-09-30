CREATE TABLE company_assignment_resource_bindings (
  resource_id TEXT PRIMARY KEY NOT NULL CHECK (length(resource_id) BETWEEN 1 AND 255),
  organization_id TEXT NOT NULL REFERENCES company_organizations(id) ON DELETE RESTRICT CHECK (organization_id = 'organization:default'),
  employee_id TEXT NOT NULL REFERENCES company_employees(id) ON DELETE RESTRICT,
  resource_revision INTEGER NOT NULL CHECK (resource_revision >= 1),
  recorded_at INTEGER NOT NULL CHECK (recorded_at >= 0)
);
CREATE INDEX company_assignment_resource_bindings_employee_idx ON company_assignment_resource_bindings(employee_id);
CREATE TABLE company_assignment_period_bindings (
  period_id TEXT PRIMARY KEY NOT NULL,
  resource_id TEXT NOT NULL REFERENCES company_assignment_resource_bindings(resource_id) ON DELETE RESTRICT,
  period_revision INTEGER NOT NULL CHECK (period_revision >= 1),
  source_revision INTEGER NOT NULL CHECK (source_revision >= 1),
  FOREIGN KEY (period_id, period_revision) REFERENCES company_organization_assignment_period_versions(period_id, revision) ON DELETE RESTRICT
);
CREATE INDEX company_assignment_period_bindings_resource_idx ON company_assignment_period_bindings(resource_id);
