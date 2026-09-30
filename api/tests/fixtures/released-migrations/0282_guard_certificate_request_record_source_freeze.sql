CREATE TRIGGER certificate_requests_source_freeze_insert
BEFORE INSERT ON certificate_requests
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'certificate-request' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'certificate_request_record_source_frozen'); END;

CREATE TRIGGER certificate_requests_source_freeze_update
BEFORE UPDATE ON certificate_requests
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'certificate-request' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'certificate_request_record_source_frozen'); END;

CREATE TRIGGER certificate_requests_source_freeze_delete
BEFORE DELETE ON certificate_requests
WHEN EXISTS (SELECT 1 FROM system_record_source_freezes WHERE owner_context = 'certificate-request' AND revision = 1)
BEGIN SELECT RAISE(ABORT, 'certificate_request_record_source_frozen'); END;
