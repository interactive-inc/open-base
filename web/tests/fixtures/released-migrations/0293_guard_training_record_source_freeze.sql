-- 研修管理を撤去する間、2台帳のどの経路からも停止を迂回できないようにする。
DROP TRIGGER IF EXISTS training_courses_source_freeze_insert;
CREATE TRIGGER training_courses_source_freeze_insert BEFORE INSERT ON training_courses
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='training' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'training_record_source_frozen'); END;
DROP TRIGGER IF EXISTS training_courses_source_freeze_update;
CREATE TRIGGER training_courses_source_freeze_update BEFORE UPDATE ON training_courses
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='training' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'training_record_source_frozen'); END;
DROP TRIGGER IF EXISTS training_courses_source_freeze_delete;
CREATE TRIGGER training_courses_source_freeze_delete BEFORE DELETE ON training_courses
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='training' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'training_record_source_frozen'); END;

DROP TRIGGER IF EXISTS training_enrollments_source_freeze_insert;
CREATE TRIGGER training_enrollments_source_freeze_insert BEFORE INSERT ON training_enrollments
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='training' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'training_record_source_frozen'); END;
DROP TRIGGER IF EXISTS training_enrollments_source_freeze_update;
CREATE TRIGGER training_enrollments_source_freeze_update BEFORE UPDATE ON training_enrollments
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='training' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'training_record_source_frozen'); END;
DROP TRIGGER IF EXISTS training_enrollments_source_freeze_delete;
CREATE TRIGGER training_enrollments_source_freeze_delete BEFORE DELETE ON training_enrollments
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='training' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'training_record_source_frozen'); END;
