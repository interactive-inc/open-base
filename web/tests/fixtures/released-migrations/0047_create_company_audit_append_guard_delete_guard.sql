CREATE TRIGGER company_audit_append_guard_prevent_delete
BEFORE DELETE ON company_audit_append_guard
BEGIN
  SELECT RAISE(ABORT, 'company audit append guard is immutable');
END;
