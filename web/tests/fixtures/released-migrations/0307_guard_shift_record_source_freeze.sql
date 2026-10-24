-- シフト業務の撤去準備中は勤務パターン・割当・交代申請の書込みを停止する。
CREATE TRIGGER shift_patterns_source_freeze_insert BEFORE INSERT ON shift_patterns
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'shift' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'shift_record_source_frozen'); END;
CREATE TRIGGER shift_patterns_source_freeze_update BEFORE UPDATE ON shift_patterns
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'shift' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'shift_record_source_frozen'); END;
CREATE TRIGGER shift_patterns_source_freeze_delete BEFORE DELETE ON shift_patterns
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'shift' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'shift_record_source_frozen'); END;

CREATE TRIGGER shift_assignments_source_freeze_insert BEFORE INSERT ON shift_assignments
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'shift' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'shift_record_source_frozen'); END;
CREATE TRIGGER shift_assignments_source_freeze_update BEFORE UPDATE ON shift_assignments
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'shift' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'shift_record_source_frozen'); END;
CREATE TRIGGER shift_assignments_source_freeze_delete BEFORE DELETE ON shift_assignments
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'shift' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'shift_record_source_frozen'); END;

CREATE TRIGGER shift_swap_requests_source_freeze_insert BEFORE INSERT ON shift_swap_requests
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'shift' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'shift_record_source_frozen'); END;
CREATE TRIGGER shift_swap_requests_source_freeze_update BEFORE UPDATE ON shift_swap_requests
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'shift' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'shift_record_source_frozen'); END;
CREATE TRIGGER shift_swap_requests_source_freeze_delete BEFORE DELETE ON shift_swap_requests
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'shift' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'shift_record_source_frozen'); END;
