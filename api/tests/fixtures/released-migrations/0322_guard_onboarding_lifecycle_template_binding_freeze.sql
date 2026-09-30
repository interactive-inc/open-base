-- 入社・退職のテンプレート設定も、手続き業務の撤去中はDB確定時に書込みを止める。
CREATE TRIGGER onboarding_lifecycle_template_bindings_source_freeze_insert BEFORE INSERT ON onboarding_lifecycle_template_bindings
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'onboarding' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'onboarding_record_source_frozen'); END;
CREATE TRIGGER onboarding_lifecycle_template_bindings_source_freeze_update BEFORE UPDATE ON onboarding_lifecycle_template_bindings
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'onboarding' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'onboarding_record_source_frozen'); END;
CREATE TRIGGER onboarding_lifecycle_template_bindings_source_freeze_delete BEFORE DELETE ON onboarding_lifecycle_template_bindings
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'onboarding' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'onboarding_record_source_frozen'); END;
