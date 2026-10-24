CREATE TRIGGER company_organization_unit_period_versions_revision_state
AFTER INSERT ON company_organization_unit_period_versions
BEGIN
  UPDATE company_organization_change_operations
  SET applied_count = applied_count + 1
  WHERE id = NEW.recorded_by_action_id;

  UPDATE company_organization_lifecycle_states
  SET revision = revision + 1, updated_at = max(updated_at, NEW.recorded_at)
  WHERE id = 1;
END;
