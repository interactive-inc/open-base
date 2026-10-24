CREATE TRIGGER company_organization_responsibility_period_versions_immutable_update
BEFORE UPDATE ON company_organization_responsibility_period_versions
BEGIN
  SELECT RAISE(ABORT, 'organization responsibilities are append only');
END;
