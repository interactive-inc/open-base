-- 入社・退職の手続き業務を撤去する間、5台帳の書込みをDB確定時に止める。
CREATE TRIGGER onboarding_templates_source_freeze_insert BEFORE INSERT ON onboarding_templates
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'onboarding' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'onboarding_record_source_frozen'); END;
CREATE TRIGGER onboarding_templates_source_freeze_update BEFORE UPDATE ON onboarding_templates
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'onboarding' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'onboarding_record_source_frozen'); END;
CREATE TRIGGER onboarding_templates_source_freeze_delete BEFORE DELETE ON onboarding_templates
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'onboarding' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'onboarding_record_source_frozen'); END;

CREATE TRIGGER onboarding_template_tasks_source_freeze_insert BEFORE INSERT ON onboarding_template_tasks
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'onboarding' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'onboarding_record_source_frozen'); END;
CREATE TRIGGER onboarding_template_tasks_source_freeze_update BEFORE UPDATE ON onboarding_template_tasks
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'onboarding' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'onboarding_record_source_frozen'); END;
CREATE TRIGGER onboarding_template_tasks_source_freeze_delete BEFORE DELETE ON onboarding_template_tasks
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'onboarding' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'onboarding_record_source_frozen'); END;

CREATE TRIGGER onboarding_assignments_source_freeze_insert BEFORE INSERT ON onboarding_assignments
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'onboarding' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'onboarding_record_source_frozen'); END;
CREATE TRIGGER onboarding_assignments_source_freeze_update BEFORE UPDATE ON onboarding_assignments
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'onboarding' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'onboarding_record_source_frozen'); END;
CREATE TRIGGER onboarding_assignments_source_freeze_delete BEFORE DELETE ON onboarding_assignments
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'onboarding' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'onboarding_record_source_frozen'); END;

CREATE TRIGGER onboarding_tasks_source_freeze_insert BEFORE INSERT ON onboarding_tasks
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'onboarding' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'onboarding_record_source_frozen'); END;
CREATE TRIGGER onboarding_tasks_source_freeze_update BEFORE UPDATE ON onboarding_tasks
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'onboarding' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'onboarding_record_source_frozen'); END;
CREATE TRIGGER onboarding_tasks_source_freeze_delete BEFORE DELETE ON onboarding_tasks
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'onboarding' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'onboarding_record_source_frozen'); END;

CREATE TRIGGER onboarding_lifecycle_deliveries_source_freeze_insert BEFORE INSERT ON onboarding_lifecycle_deliveries
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'onboarding' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'onboarding_record_source_frozen'); END;
CREATE TRIGGER onboarding_lifecycle_deliveries_source_freeze_update BEFORE UPDATE ON onboarding_lifecycle_deliveries
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'onboarding' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'onboarding_record_source_frozen'); END;
CREATE TRIGGER onboarding_lifecycle_deliveries_source_freeze_delete BEFORE DELETE ON onboarding_lifecycle_deliveries
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'onboarding' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'onboarding_record_source_frozen'); END;
