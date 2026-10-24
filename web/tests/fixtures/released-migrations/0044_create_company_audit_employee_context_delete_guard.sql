CREATE TRIGGER company_audit_event_employee_contexts_prevent_delete
BEFORE DELETE ON company_audit_event_employee_contexts
BEGIN
  SELECT RAISE(ABORT, 'company audit employee context is append only');
END;
