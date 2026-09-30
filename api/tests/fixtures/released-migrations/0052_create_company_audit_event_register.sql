CREATE TRIGGER company_audit_events_register_insert
AFTER INSERT ON company_audit_events
BEGIN
  SELECT RAISE(ABORT, 'company audit events are append only')
  WHERE EXISTS (
    SELECT 1 FROM company_audit_append_guard
    WHERE audit_id = NEW.id OR event_id = NEW.event_id
  );

  INSERT INTO company_audit_append_guard (audit_id, event_id)
  VALUES (NEW.id, NEW.event_id);
END;
