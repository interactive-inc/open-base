CREATE TRIGGER company_audit_append_guard_prevent_insert
BEFORE INSERT ON company_audit_append_guard
WHEN
  NOT EXISTS (
    SELECT 1 FROM company_audit_events
    WHERE id = NEW.audit_id AND event_id = NEW.event_id
  )
  OR EXISTS (
    SELECT 1 FROM company_audit_append_guard
    WHERE audit_id = NEW.audit_id OR event_id = NEW.event_id
  )
BEGIN
  SELECT RAISE(ABORT, 'company audit append guard is immutable');
END;
