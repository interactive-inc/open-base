CREATE TRIGGER company_audit_events_prevent_update
BEFORE UPDATE ON company_audit_events
BEGIN
  SELECT RAISE(ABORT, 'company audit events are append only');
END;
