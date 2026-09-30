DROP TRIGGER IF EXISTS company_external_identity_imports_no_delete;
CREATE TRIGGER company_external_identity_imports_no_delete
BEFORE DELETE ON company_external_identity_imports
BEGIN
  SELECT RAISE(ABORT, 'external identity import is immutable');
END;
