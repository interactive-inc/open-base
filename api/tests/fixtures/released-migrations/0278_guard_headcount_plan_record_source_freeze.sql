CREATE TRIGGER headcount_plans_source_freeze_insert
BEFORE INSERT ON headcount_plans
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'headcount-plan' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'headcount_plan_record_source_frozen'); END;

CREATE TRIGGER headcount_plans_source_freeze_update
BEFORE UPDATE ON headcount_plans
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'headcount-plan' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'headcount_plan_record_source_frozen'); END;

CREATE TRIGGER headcount_plans_source_freeze_delete
BEFORE DELETE ON headcount_plans
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'headcount-plan' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'headcount_plan_record_source_frozen'); END;
