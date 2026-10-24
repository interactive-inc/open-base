CREATE TRIGGER disciplinary_actions_source_freeze_insert
BEFORE INSERT ON disciplinary_actions
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'disciplinary-action' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'disciplinary_action_record_source_frozen'); END;

CREATE TRIGGER disciplinary_actions_source_freeze_update
BEFORE UPDATE ON disciplinary_actions
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'disciplinary-action' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'disciplinary_action_record_source_frozen'); END;

CREATE TRIGGER disciplinary_actions_source_freeze_delete
BEFORE DELETE ON disciplinary_actions
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'disciplinary-action' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'disciplinary_action_record_source_frozen'); END;
