CREATE TRIGGER company_calendar_days_source_freeze_insert
BEFORE INSERT ON company_calendar_days
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'company-calendar' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'company_calendar_record_source_frozen'); END;

CREATE TRIGGER company_calendar_days_source_freeze_update
BEFORE UPDATE ON company_calendar_days
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'company-calendar' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'company_calendar_record_source_frozen'); END;

CREATE TRIGGER company_calendar_days_source_freeze_delete
BEFORE DELETE ON company_calendar_days
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'company-calendar' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'company_calendar_record_source_frozen'); END;
