-- スキル管理を撤去する間、2台帳のどの経路からも停止を迂回できないようにする。
DROP TRIGGER IF EXISTS skill_definitions_source_freeze_insert;
CREATE TRIGGER skill_definitions_source_freeze_insert BEFORE INSERT ON skill_definitions
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='skill' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'skill_record_source_frozen'); END;
DROP TRIGGER IF EXISTS skill_definitions_source_freeze_update;
CREATE TRIGGER skill_definitions_source_freeze_update BEFORE UPDATE ON skill_definitions
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='skill' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'skill_record_source_frozen'); END;
DROP TRIGGER IF EXISTS skill_definitions_source_freeze_delete;
CREATE TRIGGER skill_definitions_source_freeze_delete BEFORE DELETE ON skill_definitions
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='skill' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'skill_record_source_frozen'); END;

DROP TRIGGER IF EXISTS employee_skills_source_freeze_insert;
CREATE TRIGGER employee_skills_source_freeze_insert BEFORE INSERT ON employee_skills
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='skill' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'skill_record_source_frozen'); END;
DROP TRIGGER IF EXISTS employee_skills_source_freeze_update;
CREATE TRIGGER employee_skills_source_freeze_update BEFORE UPDATE ON employee_skills
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='skill' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'skill_record_source_frozen'); END;
DROP TRIGGER IF EXISTS employee_skills_source_freeze_delete;
CREATE TRIGGER employee_skills_source_freeze_delete BEFORE DELETE ON employee_skills
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='skill' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'skill_record_source_frozen'); END;
