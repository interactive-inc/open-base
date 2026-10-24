CREATE TRIGGER company_audit_event_employee_contexts_prevent_update
BEFORE UPDATE ON company_audit_event_employee_contexts
BEGIN
  SELECT RAISE(ABORT, 'company audit employee context is append only');
END;
