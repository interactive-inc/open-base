-- 採用業務の撤去準備中は募集ポジションと応募者の全書込みを停止する。
CREATE TRIGGER job_openings_source_freeze_insert BEFORE INSERT ON job_openings
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'recruitment' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'recruitment_record_source_frozen'); END;
CREATE TRIGGER job_openings_source_freeze_update BEFORE UPDATE ON job_openings
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'recruitment' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'recruitment_record_source_frozen'); END;
CREATE TRIGGER job_openings_source_freeze_delete BEFORE DELETE ON job_openings
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'recruitment' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'recruitment_record_source_frozen'); END;

CREATE TRIGGER recruitment_candidates_source_freeze_insert BEFORE INSERT ON recruitment_candidates
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'recruitment' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'recruitment_record_source_frozen'); END;
CREATE TRIGGER recruitment_candidates_source_freeze_update BEFORE UPDATE ON recruitment_candidates
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'recruitment' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'recruitment_record_source_frozen'); END;
CREATE TRIGGER recruitment_candidates_source_freeze_delete BEFORE DELETE ON recruitment_candidates
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'recruitment' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'recruitment_record_source_frozen'); END;
