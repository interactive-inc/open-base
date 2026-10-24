DROP TRIGGER IF EXISTS company_legacy_personnel_action_write_guard;
CREATE TRIGGER company_legacy_personnel_action_write_guard
BEFORE INSERT ON company_resource_revisions
WHEN NEW.resource_type = 'personnel-action'
BEGIN
  SELECT RAISE(ABORT, 'company_legacy_personnel_action_write_retired');
END;
