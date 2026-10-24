-- 稟議業務の撤去準備中は起案とSystem案件対応の全書込みを停止する。
CREATE TRIGGER ringi_requests_source_freeze_insert BEFORE INSERT ON ringi_requests
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'ringi' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'ringi_record_source_frozen'); END;
CREATE TRIGGER ringi_requests_source_freeze_update BEFORE UPDATE ON ringi_requests
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'ringi' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'ringi_record_source_frozen'); END;
CREATE TRIGGER ringi_requests_source_freeze_delete BEFORE DELETE ON ringi_requests
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'ringi' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'ringi_record_source_frozen'); END;

CREATE TRIGGER ringi_procedure_bindings_source_freeze_insert BEFORE INSERT ON ringi_procedure_bindings
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'ringi' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'ringi_record_source_frozen'); END;
CREATE TRIGGER ringi_procedure_bindings_source_freeze_update BEFORE UPDATE ON ringi_procedure_bindings
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'ringi' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'ringi_record_source_frozen'); END;
CREATE TRIGGER ringi_procedure_bindings_source_freeze_delete BEFORE DELETE ON ringi_procedure_bindings
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'ringi' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'ringi_record_source_frozen'); END;
