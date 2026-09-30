CREATE TRIGGER company_audit_event_appends_dispatch
AFTER INSERT ON company_audit_event_appends
BEGIN
  INSERT INTO company_audit_events (
    event_id, request_id, actor_account_id, action, target_type, target_id, outcome,
    reason_code, authorization_json, before_json, after_json, metadata_json,
    client_ip, client_name, created_at
  ) VALUES (
    NEW.event_id, NEW.request_id, NEW.actor_account_id, NEW.action, NEW.target_type,
    NEW.target_id, NEW.outcome, NEW.reason_code, NEW.authorization_json, NEW.before_json,
    NEW.after_json, NEW.metadata_json, NEW.client_ip, NEW.client_name, NEW.created_at
  );

  INSERT INTO company_audit_event_employee_contexts (audit_event_id, employee_id)
  SELECT event.id, NEW.actor_employee_id
  FROM company_audit_events event
  WHERE event.event_id = NEW.event_id
    AND NEW.actor_employee_id IS NOT NULL;

  DELETE FROM company_audit_event_appends WHERE staging_id = NEW.staging_id;
END;
