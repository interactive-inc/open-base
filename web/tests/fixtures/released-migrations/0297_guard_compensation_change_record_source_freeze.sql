-- 給与改定業務の撤去中は、原記録への全書込みをDB境界で停止する。
DROP TRIGGER IF EXISTS salary_revisions_source_freeze_insert;
CREATE TRIGGER salary_revisions_source_freeze_insert BEFORE INSERT ON salary_revisions
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='compensation-change' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'compensation_change_record_source_frozen'); END;
DROP TRIGGER IF EXISTS salary_revisions_source_freeze_update;
CREATE TRIGGER salary_revisions_source_freeze_update BEFORE UPDATE ON salary_revisions
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='compensation-change' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'compensation_change_record_source_frozen'); END;
DROP TRIGGER IF EXISTS salary_revisions_source_freeze_delete;
CREATE TRIGGER salary_revisions_source_freeze_delete BEFORE DELETE ON salary_revisions
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='compensation-change' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'compensation_change_record_source_frozen'); END;
