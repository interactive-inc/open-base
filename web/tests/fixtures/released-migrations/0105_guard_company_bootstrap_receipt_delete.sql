CREATE TRIGGER company_bootstrap_receipts_immutable_delete
BEFORE DELETE ON company_bootstrap_receipts
BEGIN
  SELECT RAISE(ABORT, 'company bootstrap receipt immutable');
END;
