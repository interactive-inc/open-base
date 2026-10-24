DROP TRIGGER IF EXISTS company_organization_resource_commit_guard;
CREATE TRIGGER company_organization_resource_commit_guard
BEFORE UPDATE OF revision ON company_organizations
WHEN NEW.id = 'organization:default'
BEGIN
  SELECT RAISE(ABORT, 'organization resource history mismatch')
  WHERE EXISTS (SELECT 1 FROM company_organization_resource_mismatches);
END;
