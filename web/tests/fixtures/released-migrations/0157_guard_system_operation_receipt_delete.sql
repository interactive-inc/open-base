DROP TRIGGER IF EXISTS system_operation_receipts_no_delete;
CREATE TRIGGER system_operation_receipts_no_delete BEFORE DELETE ON system_operation_receipts
BEGIN SELECT RAISE(ABORT, 'system operation receipt is immutable'); END;
