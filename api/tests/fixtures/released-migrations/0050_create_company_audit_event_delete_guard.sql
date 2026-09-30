CREATE TRIGGER company_audit_events_prevent_delete
BEFORE DELETE ON company_audit_events
BEGIN
  SELECT RAISE(ABORT, 'company audit events are append only');
END;
