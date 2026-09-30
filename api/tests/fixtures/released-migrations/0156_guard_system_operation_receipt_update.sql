DROP TRIGGER IF EXISTS system_operation_receipts_no_update;
CREATE TRIGGER system_operation_receipts_no_update BEFORE UPDATE ON system_operation_receipts
BEGIN SELECT RAISE(ABORT, 'system operation receipt is immutable'); END;
