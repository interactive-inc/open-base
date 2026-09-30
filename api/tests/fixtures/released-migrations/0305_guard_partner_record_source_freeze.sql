-- 取引先業務の撤去準備中は取引先と契約記録の全書込みを停止する。
CREATE TRIGGER partners_source_freeze_insert BEFORE INSERT ON partners
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'partner' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'partner_record_source_frozen'); END;
CREATE TRIGGER partners_source_freeze_update BEFORE UPDATE ON partners
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'partner' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'partner_record_source_frozen'); END;
CREATE TRIGGER partners_source_freeze_delete BEFORE DELETE ON partners
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'partner' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'partner_record_source_frozen'); END;

CREATE TRIGGER partner_contracts_source_freeze_insert BEFORE INSERT ON partner_contracts
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'partner' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'partner_record_source_frozen'); END;
CREATE TRIGGER partner_contracts_source_freeze_update BEFORE UPDATE ON partner_contracts
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'partner' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'partner_record_source_frozen'); END;
CREATE TRIGGER partner_contracts_source_freeze_delete BEFORE DELETE ON partner_contracts
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'partner' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'partner_record_source_frozen'); END;
