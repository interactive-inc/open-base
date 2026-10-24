DROP TRIGGER IF EXISTS company_external_identity_imports_no_update;
CREATE TRIGGER company_external_identity_imports_no_update
BEFORE UPDATE ON company_external_identity_imports
BEGIN
  SELECT RAISE(ABORT, 'external identity import is immutable');
END;
