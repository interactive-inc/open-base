CREATE TRIGGER employee_work_styles_source_freeze_insert
BEFORE INSERT ON employee_work_styles
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'work-style' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'work_style_record_source_frozen'); END;

CREATE TRIGGER employee_work_styles_source_freeze_update
BEFORE UPDATE ON employee_work_styles
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'work-style' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'work_style_record_source_frozen'); END;

CREATE TRIGGER employee_work_styles_source_freeze_delete
BEFORE DELETE ON employee_work_styles
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'work-style' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'work_style_record_source_frozen'); END;
