CREATE TABLE leave_decision_notifications (
  job_id TEXT PRIMARY KEY NOT NULL REFERENCES system_jobs(id) ON DELETE RESTRICT,
  leave_request_id INTEGER NOT NULL UNIQUE REFERENCES leave_requests(id) ON DELETE RESTRICT,
  decision_audit_id TEXT NOT NULL UNIQUE REFERENCES system_audit_events(event_id) ON DELETE RESTRICT,
  payload_json TEXT NOT NULL CHECK (json_valid(payload_json)),
  CHECK (json_extract(payload_json, '$.decisionAuditId') IS decision_audit_id),
  CHECK (json_extract(payload_json, '$.leaveRequestId') IS leave_request_id)
);

CREATE TRIGGER leave_decision_notifications_immutable_update
BEFORE UPDATE ON leave_decision_notifications
BEGIN
  SELECT RAISE(ABORT, 'leave decision notification is immutable');
END;

CREATE TRIGGER leave_decision_notifications_immutable_delete
BEFORE DELETE ON leave_decision_notifications
BEGIN
  SELECT RAISE(ABORT, 'leave decision notification is immutable');
END;
