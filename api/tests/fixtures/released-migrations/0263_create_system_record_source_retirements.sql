CREATE TABLE system_record_source_retirements (
  id TEXT PRIMARY KEY NOT NULL,
  freeze_id TEXT NOT NULL UNIQUE REFERENCES system_record_source_freezes(id),
  plan_id TEXT NOT NULL UNIQUE REFERENCES system_record_retirement_plans(id),
  terminal_receipt_id TEXT NOT NULL REFERENCES system_record_retirement_receipts(id),
  proposal_id TEXT NOT NULL UNIQUE REFERENCES system_proposals(id),
  case_id TEXT NOT NULL UNIQUE REFERENCES system_cases(id),
  execution_authorization_id TEXT NOT NULL UNIQUE REFERENCES system_execution_authorizations(id),
  audit_event_id TEXT NOT NULL UNIQUE REFERENCES system_audit_events(event_id),
  snapshot_json TEXT NOT NULL CHECK(json_valid(snapshot_json)),
  CHECK(json_extract(snapshot_json,'$.id') IS id),
  CHECK(json_extract(snapshot_json,'$.freezeId') IS freeze_id),
  CHECK(json_extract(snapshot_json,'$.planId') IS plan_id),
  CHECK(json_extract(snapshot_json,'$.terminalReceiptId') IS terminal_receipt_id),
  CHECK(json_extract(snapshot_json,'$.proposalId') IS proposal_id),
  CHECK(json_extract(snapshot_json,'$.caseId') IS case_id),
  CHECK(json_extract(snapshot_json,'$.executionAuthorizationId') IS execution_authorization_id),
  CHECK(json_extract(snapshot_json,'$.auditEventId') IS audit_event_id)
);
