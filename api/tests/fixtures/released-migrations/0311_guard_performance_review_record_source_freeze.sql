-- Stop every write to the eight performance-review source ledgers during a System freeze.
CREATE TRIGGER evaluation_sheet_audit_logs_source_freeze_insert BEFORE INSERT ON evaluation_sheet_audit_logs
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'performance-review' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'performance_review_record_source_frozen'); END;

CREATE TRIGGER evaluation_sheet_audit_logs_source_freeze_update BEFORE UPDATE ON evaluation_sheet_audit_logs
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'performance-review' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'performance_review_record_source_frozen'); END;

CREATE TRIGGER evaluation_sheet_audit_logs_source_freeze_delete BEFORE DELETE ON evaluation_sheet_audit_logs
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'performance-review' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'performance_review_record_source_frozen'); END;

CREATE TRIGGER evaluation_sheets_source_freeze_insert BEFORE INSERT ON evaluation_sheets
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'performance-review' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'performance_review_record_source_frozen'); END;

CREATE TRIGGER evaluation_sheets_source_freeze_update BEFORE UPDATE ON evaluation_sheets
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'performance-review' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'performance_review_record_source_frozen'); END;

CREATE TRIGGER evaluation_sheets_source_freeze_delete BEFORE DELETE ON evaluation_sheets
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'performance-review' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'performance_review_record_source_frozen'); END;

CREATE TRIGGER evaluation_templates_source_freeze_insert BEFORE INSERT ON evaluation_templates
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'performance-review' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'performance_review_record_source_frozen'); END;

CREATE TRIGGER evaluation_templates_source_freeze_update BEFORE UPDATE ON evaluation_templates
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'performance-review' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'performance_review_record_source_frozen'); END;

CREATE TRIGGER evaluation_templates_source_freeze_delete BEFORE DELETE ON evaluation_templates
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'performance-review' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'performance_review_record_source_frozen'); END;

CREATE TRIGGER goal_evaluations_source_freeze_insert BEFORE INSERT ON goal_evaluations
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'performance-review' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'performance_review_record_source_frozen'); END;

CREATE TRIGGER goal_evaluations_source_freeze_update BEFORE UPDATE ON goal_evaluations
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'performance-review' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'performance_review_record_source_frozen'); END;

CREATE TRIGGER goal_evaluations_source_freeze_delete BEFORE DELETE ON goal_evaluations
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'performance-review' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'performance_review_record_source_frozen'); END;

CREATE TRIGGER performance_goals_source_freeze_insert BEFORE INSERT ON performance_goals
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'performance-review' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'performance_review_record_source_frozen'); END;

CREATE TRIGGER performance_goals_source_freeze_update BEFORE UPDATE ON performance_goals
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'performance-review' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'performance_review_record_source_frozen'); END;

CREATE TRIGGER performance_goals_source_freeze_delete BEFORE DELETE ON performance_goals
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'performance-review' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'performance_review_record_source_frozen'); END;

CREATE TRIGGER review_cycle_policies_source_freeze_insert BEFORE INSERT ON review_cycle_policies
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'performance-review' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'performance_review_record_source_frozen'); END;

CREATE TRIGGER review_cycle_policies_source_freeze_update BEFORE UPDATE ON review_cycle_policies
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'performance-review' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'performance_review_record_source_frozen'); END;

CREATE TRIGGER review_cycle_policies_source_freeze_delete BEFORE DELETE ON review_cycle_policies
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'performance-review' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'performance_review_record_source_frozen'); END;

CREATE TRIGGER review_cycles_source_freeze_insert BEFORE INSERT ON review_cycles
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'performance-review' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'performance_review_record_source_frozen'); END;

CREATE TRIGGER review_cycles_source_freeze_update BEFORE UPDATE ON review_cycles
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'performance-review' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'performance_review_record_source_frozen'); END;

CREATE TRIGGER review_cycles_source_freeze_delete BEFORE DELETE ON review_cycles
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'performance-review' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'performance_review_record_source_frozen'); END;

CREATE TRIGGER review_forms_source_freeze_insert BEFORE INSERT ON review_forms
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'performance-review' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'performance_review_record_source_frozen'); END;

CREATE TRIGGER review_forms_source_freeze_update BEFORE UPDATE ON review_forms
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'performance-review' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'performance_review_record_source_frozen'); END;

CREATE TRIGGER review_forms_source_freeze_delete BEFORE DELETE ON review_forms
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'performance-review' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'performance_review_record_source_frozen'); END;
