CREATE TRIGGER company_organization_units_immutable_delete
BEFORE DELETE ON company_organization_units
BEGIN
  SELECT RAISE(ABORT, 'organization unit identity is append only');
END;
