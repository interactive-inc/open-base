CREATE TRIGGER company_audit_event_employee_contexts_validate_insert
BEFORE INSERT ON company_audit_event_employee_contexts
WHEN NOT EXISTS (
  SELECT 1 FROM company_audit_events WHERE id = NEW.audit_event_id
)
BEGIN
  SELECT RAISE(ABORT, 'company audit employee context requires an audit event');
END;
