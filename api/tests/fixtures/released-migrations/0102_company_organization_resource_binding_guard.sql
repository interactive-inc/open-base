DROP TRIGGER IF EXISTS company_organization_resource_binding_guard;
CREATE TRIGGER company_organization_resource_binding_guard
AFTER INSERT ON company_organization_resource_bindings
WHEN 1
BEGIN
  SELECT RAISE(ABORT, 'organization resource history mismatch')
  WHERE EXISTS (SELECT 1 FROM company_organization_resource_mismatches WHERE organization_unit_id = NEW.organization_unit_id) OR NOT EXISTS (SELECT 1 FROM company_organization_unit_period_versions WHERE organization_unit_id = NEW.organization_unit_id);
END;
