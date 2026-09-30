CREATE TRIGGER company_organization_responsibility_period_versions_immutable_delete
BEFORE DELETE ON company_organization_responsibility_period_versions
BEGIN
  SELECT RAISE(ABORT, 'organization responsibilities are append only');
END;
