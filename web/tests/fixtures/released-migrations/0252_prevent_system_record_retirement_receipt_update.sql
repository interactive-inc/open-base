CREATE TRIGGER system_record_retirement_receipts_update BEFORE UPDATE ON system_record_retirement_receipts
BEGIN
  SELECT RAISE(ABORT,'record_retirement_receipt_immutable');
END;
