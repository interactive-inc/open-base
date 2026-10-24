CREATE TRIGGER company_organization_unit_period_versions_immutable_delete
BEFORE DELETE ON company_organization_unit_period_versions
BEGIN
  SELECT RAISE(ABORT, 'organization unit periods are append only');
END;
