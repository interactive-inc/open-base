-- アンケートを撤去する間、2台帳のどの経路からも停止を迂回できないようにする。
DROP TRIGGER IF EXISTS surveys_source_freeze_insert;
CREATE TRIGGER surveys_source_freeze_insert BEFORE INSERT ON surveys
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='survey' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'survey_record_source_frozen'); END;
DROP TRIGGER IF EXISTS surveys_source_freeze_update;
CREATE TRIGGER surveys_source_freeze_update BEFORE UPDATE ON surveys
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='survey' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'survey_record_source_frozen'); END;
DROP TRIGGER IF EXISTS surveys_source_freeze_delete;
CREATE TRIGGER surveys_source_freeze_delete BEFORE DELETE ON surveys
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='survey' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'survey_record_source_frozen'); END;

DROP TRIGGER IF EXISTS survey_responses_source_freeze_insert;
CREATE TRIGGER survey_responses_source_freeze_insert BEFORE INSERT ON survey_responses
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='survey' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'survey_record_source_frozen'); END;
DROP TRIGGER IF EXISTS survey_responses_source_freeze_update;
CREATE TRIGGER survey_responses_source_freeze_update BEFORE UPDATE ON survey_responses
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='survey' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'survey_record_source_frozen'); END;
DROP TRIGGER IF EXISTS survey_responses_source_freeze_delete;
CREATE TRIGGER survey_responses_source_freeze_delete BEFORE DELETE ON survey_responses
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='survey' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'survey_record_source_frozen'); END;
