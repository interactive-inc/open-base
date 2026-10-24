-- 規程業務の撤去準備中は規程と改定版の全書込みを停止する。
CREATE TRIGGER regulations_source_freeze_insert BEFORE INSERT ON regulations
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'regulation' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'regulation_record_source_frozen'); END;
CREATE TRIGGER regulations_source_freeze_update BEFORE UPDATE ON regulations
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'regulation' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'regulation_record_source_frozen'); END;
CREATE TRIGGER regulations_source_freeze_delete BEFORE DELETE ON regulations
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'regulation' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'regulation_record_source_frozen'); END;

CREATE TRIGGER regulation_versions_source_freeze_insert BEFORE INSERT ON regulation_versions
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'regulation' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'regulation_record_source_frozen'); END;
CREATE TRIGGER regulation_versions_source_freeze_update BEFORE UPDATE ON regulation_versions
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'regulation' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'regulation_record_source_frozen'); END;
CREATE TRIGGER regulation_versions_source_freeze_delete BEFORE DELETE ON regulation_versions
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'regulation' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'regulation_record_source_frozen'); END;
