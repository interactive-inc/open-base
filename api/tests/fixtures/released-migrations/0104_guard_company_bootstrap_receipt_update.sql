CREATE TRIGGER company_bootstrap_receipts_immutable_update
BEFORE UPDATE ON company_bootstrap_receipts
BEGIN
  SELECT RAISE(ABORT, 'company bootstrap receipt immutable');
END;
