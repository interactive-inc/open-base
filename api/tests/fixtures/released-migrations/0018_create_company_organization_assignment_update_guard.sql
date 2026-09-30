CREATE TRIGGER company_organization_assignment_period_versions_immutable_update
BEFORE UPDATE ON company_organization_assignment_period_versions
BEGIN
  SELECT RAISE(ABORT, 'organization assignments are append only');
END;
