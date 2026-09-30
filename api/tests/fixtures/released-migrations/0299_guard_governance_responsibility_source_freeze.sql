CREATE TRIGGER governance_org_role_assignments_source_freeze_insert_guard
BEFORE INSERT ON governance_org_role_assignments
WHEN EXISTS (
  SELECT 1 FROM system_record_source_freezes
  WHERE owner_context = 'governance' AND revision = 1
)
BEGIN
  SELECT RAISE(ABORT, 'governance_org_role_assignment_source_frozen');
END;

CREATE TRIGGER governance_org_role_assignments_source_freeze_update_guard
BEFORE UPDATE ON governance_org_role_assignments
WHEN EXISTS (
  SELECT 1 FROM system_record_source_freezes
  WHERE owner_context = 'governance' AND revision = 1
)
BEGIN
  SELECT RAISE(ABORT, 'governance_org_role_assignment_source_frozen');
END;

CREATE TRIGGER governance_org_role_assignments_source_freeze_delete_guard
BEFORE DELETE ON governance_org_role_assignments
WHEN EXISTS (
  SELECT 1 FROM system_record_source_freezes
  WHERE owner_context = 'governance' AND revision = 1
)
BEGIN
  SELECT RAISE(ABORT, 'governance_org_role_assignment_source_frozen');
END;
