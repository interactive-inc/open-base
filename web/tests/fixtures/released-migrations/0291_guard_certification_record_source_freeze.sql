-- 資格管理を撤去する間、2台帳のどの経路からも停止を迂回できないようにする。
DROP TRIGGER IF EXISTS certification_definitions_source_freeze_insert;
CREATE TRIGGER certification_definitions_source_freeze_insert BEFORE INSERT ON certification_definitions
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='certification' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'certification_record_source_frozen'); END;
DROP TRIGGER IF EXISTS certification_definitions_source_freeze_update;
CREATE TRIGGER certification_definitions_source_freeze_update BEFORE UPDATE ON certification_definitions
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='certification' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'certification_record_source_frozen'); END;
DROP TRIGGER IF EXISTS certification_definitions_source_freeze_delete;
CREATE TRIGGER certification_definitions_source_freeze_delete BEFORE DELETE ON certification_definitions
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='certification' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'certification_record_source_frozen'); END;

DROP TRIGGER IF EXISTS employee_certifications_source_freeze_insert;
CREATE TRIGGER employee_certifications_source_freeze_insert BEFORE INSERT ON employee_certifications
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='certification' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'certification_record_source_frozen'); END;
DROP TRIGGER IF EXISTS employee_certifications_source_freeze_update;
CREATE TRIGGER employee_certifications_source_freeze_update BEFORE UPDATE ON employee_certifications
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='certification' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'certification_record_source_frozen'); END;
DROP TRIGGER IF EXISTS employee_certifications_source_freeze_delete;
CREATE TRIGGER employee_certifications_source_freeze_delete BEFORE DELETE ON employee_certifications
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='certification' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'certification_record_source_frozen'); END;
