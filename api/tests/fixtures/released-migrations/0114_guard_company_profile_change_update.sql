DROP TRIGGER IF EXISTS company_profile_change_receipts_immutable_update;
CREATE TRIGGER company_profile_change_receipts_immutable_update
BEFORE UPDATE ON company_profile_change_receipts
BEGIN
  SELECT RAISE(ABORT, 'company profile change receipt is immutable');
END;
