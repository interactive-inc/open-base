-- 会議業務の撤去準備中は会議体・議事録・意思決定の書込みを停止する。
CREATE TRIGGER meetings_source_freeze_insert BEFORE INSERT ON meetings
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'meeting' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'meeting_record_source_frozen'); END;
CREATE TRIGGER meetings_source_freeze_update BEFORE UPDATE ON meetings
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'meeting' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'meeting_record_source_frozen'); END;
CREATE TRIGGER meetings_source_freeze_delete BEFORE DELETE ON meetings
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'meeting' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'meeting_record_source_frozen'); END;

CREATE TRIGGER meeting_minutes_records_source_freeze_insert BEFORE INSERT ON meeting_minutes_records
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'meeting' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'meeting_record_source_frozen'); END;
CREATE TRIGGER meeting_minutes_records_source_freeze_update BEFORE UPDATE ON meeting_minutes_records
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'meeting' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'meeting_record_source_frozen'); END;
CREATE TRIGGER meeting_minutes_records_source_freeze_delete BEFORE DELETE ON meeting_minutes_records
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'meeting' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'meeting_record_source_frozen'); END;

CREATE TRIGGER decision_records_source_freeze_insert BEFORE INSERT ON decision_records
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'meeting' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'meeting_record_source_frozen'); END;
CREATE TRIGGER decision_records_source_freeze_update BEFORE UPDATE ON decision_records
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'meeting' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'meeting_record_source_frozen'); END;
CREATE TRIGGER decision_records_source_freeze_delete BEFORE DELETE ON decision_records
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'meeting' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'meeting_record_source_frozen'); END;
