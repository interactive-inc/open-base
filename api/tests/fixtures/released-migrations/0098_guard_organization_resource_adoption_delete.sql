DROP TRIGGER IF EXISTS company_organization_resource_adoptions_no_delete;
CREATE TRIGGER company_organization_resource_adoptions_no_delete
BEFORE DELETE ON company_organization_resource_adoptions
BEGIN
  SELECT RAISE(ABORT, 'organization resource connection is immutable');
END;
