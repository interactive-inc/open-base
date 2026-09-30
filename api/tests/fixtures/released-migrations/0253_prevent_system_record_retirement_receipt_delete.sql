CREATE TRIGGER system_record_retirement_receipts_delete BEFORE DELETE ON system_record_retirement_receipts
BEGIN
  SELECT RAISE(ABORT,'record_retirement_receipt_immutable');
END;
