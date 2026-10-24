DROP TRIGGER IF EXISTS company_profile_legacy_write_guard;
CREATE TRIGGER company_profile_legacy_write_guard
BEFORE UPDATE OF name, representative_name ON company_organizations
WHEN (NEW.name IS NOT OLD.name OR NEW.representative_name IS NOT OLD.representative_name)
AND EXISTS (SELECT 1 FROM company_resource_heads WHERE organization_id = OLD.id AND resource_type = 'company-profile')
BEGIN
  SELECT RAISE(ABORT, 'company profile legacy write is not canonical');
END;
