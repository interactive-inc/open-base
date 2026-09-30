-- キャリア業務を撤去する間、3台帳の全書込み経路を停止する。
DROP TRIGGER IF EXISTS career_postings_source_freeze_insert;
CREATE TRIGGER career_postings_source_freeze_insert BEFORE INSERT ON career_postings
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='career' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'career_record_source_frozen'); END;
DROP TRIGGER IF EXISTS career_postings_source_freeze_update;
CREATE TRIGGER career_postings_source_freeze_update BEFORE UPDATE ON career_postings
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='career' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'career_record_source_frozen'); END;
DROP TRIGGER IF EXISTS career_postings_source_freeze_delete;
CREATE TRIGGER career_postings_source_freeze_delete BEFORE DELETE ON career_postings
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='career' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'career_record_source_frozen'); END;

DROP TRIGGER IF EXISTS career_applications_source_freeze_insert;
CREATE TRIGGER career_applications_source_freeze_insert BEFORE INSERT ON career_applications
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='career' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'career_record_source_frozen'); END;
DROP TRIGGER IF EXISTS career_applications_source_freeze_update;
CREATE TRIGGER career_applications_source_freeze_update BEFORE UPDATE ON career_applications
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='career' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'career_record_source_frozen'); END;
DROP TRIGGER IF EXISTS career_applications_source_freeze_delete;
CREATE TRIGGER career_applications_source_freeze_delete BEFORE DELETE ON career_applications
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='career' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'career_record_source_frozen'); END;

DROP TRIGGER IF EXISTS career_sheets_source_freeze_insert;
CREATE TRIGGER career_sheets_source_freeze_insert BEFORE INSERT ON career_sheets
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='career' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'career_record_source_frozen'); END;
DROP TRIGGER IF EXISTS career_sheets_source_freeze_update;
CREATE TRIGGER career_sheets_source_freeze_update BEFORE UPDATE ON career_sheets
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='career' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'career_record_source_frozen'); END;
DROP TRIGGER IF EXISTS career_sheets_source_freeze_delete;
CREATE TRIGGER career_sheets_source_freeze_delete BEFORE DELETE ON career_sheets
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='career' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'career_record_source_frozen'); END;
