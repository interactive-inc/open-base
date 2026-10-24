-- サンクス管理を撤去する間、4台帳のどの経路からも停止を迂回できないようにする。
DROP TRIGGER IF EXISTS thanks_messages_source_freeze_insert;
CREATE TRIGGER thanks_messages_source_freeze_insert BEFORE INSERT ON thanks_messages
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='thanks' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'thanks_record_source_frozen'); END;
DROP TRIGGER IF EXISTS thanks_messages_source_freeze_update;
CREATE TRIGGER thanks_messages_source_freeze_update BEFORE UPDATE ON thanks_messages
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='thanks' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'thanks_record_source_frozen'); END;
DROP TRIGGER IF EXISTS thanks_messages_source_freeze_delete;
CREATE TRIGGER thanks_messages_source_freeze_delete BEFORE DELETE ON thanks_messages
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='thanks' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'thanks_record_source_frozen'); END;

DROP TRIGGER IF EXISTS thanks_point_budgets_source_freeze_insert;
CREATE TRIGGER thanks_point_budgets_source_freeze_insert BEFORE INSERT ON thanks_point_budgets
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='thanks' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'thanks_record_source_frozen'); END;
DROP TRIGGER IF EXISTS thanks_point_budgets_source_freeze_update;
CREATE TRIGGER thanks_point_budgets_source_freeze_update BEFORE UPDATE ON thanks_point_budgets
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='thanks' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'thanks_record_source_frozen'); END;
DROP TRIGGER IF EXISTS thanks_point_budgets_source_freeze_delete;
CREATE TRIGGER thanks_point_budgets_source_freeze_delete BEFORE DELETE ON thanks_point_budgets
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='thanks' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'thanks_record_source_frozen'); END;

DROP TRIGGER IF EXISTS thanks_rewards_source_freeze_insert;
CREATE TRIGGER thanks_rewards_source_freeze_insert BEFORE INSERT ON thanks_rewards
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='thanks' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'thanks_record_source_frozen'); END;
DROP TRIGGER IF EXISTS thanks_rewards_source_freeze_update;
CREATE TRIGGER thanks_rewards_source_freeze_update BEFORE UPDATE ON thanks_rewards
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='thanks' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'thanks_record_source_frozen'); END;
DROP TRIGGER IF EXISTS thanks_rewards_source_freeze_delete;
CREATE TRIGGER thanks_rewards_source_freeze_delete BEFORE DELETE ON thanks_rewards
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='thanks' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'thanks_record_source_frozen'); END;

DROP TRIGGER IF EXISTS thanks_redemptions_source_freeze_insert;
CREATE TRIGGER thanks_redemptions_source_freeze_insert BEFORE INSERT ON thanks_redemptions
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='thanks' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'thanks_record_source_frozen'); END;
DROP TRIGGER IF EXISTS thanks_redemptions_source_freeze_update;
CREATE TRIGGER thanks_redemptions_source_freeze_update BEFORE UPDATE ON thanks_redemptions
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='thanks' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'thanks_record_source_frozen'); END;
DROP TRIGGER IF EXISTS thanks_redemptions_source_freeze_delete;
CREATE TRIGGER thanks_redemptions_source_freeze_delete BEFORE DELETE ON thanks_redemptions
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context='thanks' AND revision=1)
BEGIN SELECT RAISE(ABORT, 'thanks_record_source_frozen'); END;
