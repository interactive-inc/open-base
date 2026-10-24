CREATE TRIGGER company_organization_units_immutable_update
BEFORE UPDATE ON company_organization_units
BEGIN
  SELECT RAISE(ABORT, 'organization unit identity is immutable');
END;
