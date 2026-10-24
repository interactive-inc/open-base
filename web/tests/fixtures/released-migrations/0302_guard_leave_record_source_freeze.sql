-- 休暇業務の撤去準備中は、申請・残数・案件対応・判断通知の全書込みを停止する。
CREATE TRIGGER leave_requests_source_freeze_insert BEFORE INSERT ON leave_requests
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'leave' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'leave_record_source_frozen'); END;
CREATE TRIGGER leave_requests_source_freeze_update BEFORE UPDATE ON leave_requests
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'leave' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'leave_record_source_frozen'); END;
CREATE TRIGGER leave_requests_source_freeze_delete BEFORE DELETE ON leave_requests
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'leave' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'leave_record_source_frozen'); END;

CREATE TRIGGER leave_balances_source_freeze_insert BEFORE INSERT ON leave_balances
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'leave' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'leave_record_source_frozen'); END;
CREATE TRIGGER leave_balances_source_freeze_update BEFORE UPDATE ON leave_balances
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'leave' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'leave_record_source_frozen'); END;
CREATE TRIGGER leave_balances_source_freeze_delete BEFORE DELETE ON leave_balances
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'leave' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'leave_record_source_frozen'); END;

CREATE TRIGGER leave_procedure_bindings_source_freeze_insert BEFORE INSERT ON leave_procedure_bindings
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'leave' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'leave_record_source_frozen'); END;
CREATE TRIGGER leave_procedure_bindings_source_freeze_update BEFORE UPDATE ON leave_procedure_bindings
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'leave' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'leave_record_source_frozen'); END;
CREATE TRIGGER leave_procedure_bindings_source_freeze_delete BEFORE DELETE ON leave_procedure_bindings
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'leave' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'leave_record_source_frozen'); END;

CREATE TRIGGER leave_decision_notifications_source_freeze_insert BEFORE INSERT ON leave_decision_notifications
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'leave' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'leave_record_source_frozen'); END;
CREATE TRIGGER leave_decision_notifications_source_freeze_update BEFORE UPDATE ON leave_decision_notifications
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'leave' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'leave_record_source_frozen'); END;
CREATE TRIGGER leave_decision_notifications_source_freeze_delete BEFORE DELETE ON leave_decision_notifications
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'leave' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'leave_record_source_frozen'); END;
