CREATE TABLE leave_procedure_bindings (
  request_key TEXT PRIMARY KEY NOT NULL CHECK (length(request_key) BETWEEN 1 AND 255),
  leave_request_id INTEGER NOT NULL UNIQUE REFERENCES leave_requests(id) ON DELETE RESTRICT,
  previous_leave_request_id INTEGER REFERENCES leave_requests(id) ON DELETE RESTRICT,
  application_id INTEGER NOT NULL UNIQUE REFERENCES system_proposal_numbers(number) ON DELETE RESTRICT,
  series_id TEXT NOT NULL UNIQUE REFERENCES system_proposal_series(id) ON DELETE RESTRICT,
  case_id TEXT NOT NULL UNIQUE REFERENCES system_cases(id) ON DELETE RESTRICT,
  proposal_digest TEXT NOT NULL CHECK (length(proposal_digest) = 64 AND proposal_digest NOT GLOB '*[^0-9a-f]*'),
  created_at INTEGER NOT NULL CHECK (created_at >= 0)
);
CREATE UNIQUE INDEX leave_procedure_resubmission_once
  ON leave_procedure_bindings(previous_leave_request_id) WHERE previous_leave_request_id IS NOT NULL;

CREATE TRIGGER leave_procedure_binding_matches_proposal
BEFORE INSERT ON leave_procedure_bindings
WHEN NOT EXISTS (
  SELECT 1 FROM leave_requests request
  JOIN system_proposal_numbers number ON number.number = NEW.application_id AND number.series_id = NEW.series_id
  JOIN system_proposals proposal ON proposal.series_id = NEW.series_id AND proposal.version = 1
  JOIN system_proposal_cases association ON association.proposal_id = proposal.id AND association.case_id = NEW.case_id
  JOIN system_cases workflow_case ON workflow_case.id = NEW.case_id
  JOIN system_procedure_definition_revisions definition
    ON definition.procedure_key = proposal.procedure_key AND definition.revision = proposal.procedure_revision
  WHERE request.id = NEW.leave_request_id AND request.status = 'pending'
    AND proposal.digest = NEW.proposal_digest AND proposal.created_at = NEW.created_at
    AND request.created_at <= strftime('%Y-%m-%dT%H:%M:%fZ', proposal.created_at / 1000.0, 'unixepoch')
    AND definition.completion_operation_key = 'leave.request.authorize'
    AND workflow_case.subject_context = 'leave' AND workflow_case.subject_kind = 'request'
    AND workflow_case.subject_id = NEW.request_key AND workflow_case.subject_version = '1'
    AND workflow_case.status = 'pending'
    AND json_extract(proposal.body_json, '$.employeeId') IS request.employee_id
    AND json_extract(proposal.body_json, '$.leaveType') IS request.leave_type
    AND json_extract(proposal.body_json, '$.startDate') IS request.start_date
    AND json_extract(proposal.body_json, '$.endDate') IS request.end_date
    AND json_extract(proposal.body_json, '$.days') IS request.days
    AND json_extract(proposal.body_json, '$.unit') IS request.unit
    AND json_extract(proposal.body_json, '$.hours') IS request.hours
    AND json_extract(proposal.body_json, '$.consumedDays') IS request.consumed_days
    AND json_extract(proposal.body_json, '$.reason') IS request.reason
    AND (NEW.previous_leave_request_id IS NULL OR EXISTS (
      SELECT 1 FROM leave_procedure_bindings previous
      JOIN leave_requests original ON original.id = previous.leave_request_id
      JOIN system_cases previous_case ON previous_case.id = previous.case_id
      WHERE previous.leave_request_id = NEW.previous_leave_request_id
        AND previous.leave_request_id <> NEW.leave_request_id
        AND original.employee_id = request.employee_id AND previous_case.status = 'returned'
        AND previous_case.created_by_account_id = proposal.created_by_account_id
        AND previous_case.updated_at <= NEW.created_at
    ))
)
BEGIN
  SELECT RAISE(ABORT, 'leave_procedure_proposal_mismatch');
END;

CREATE TRIGGER leave_procedure_binding_immutable_update
BEFORE UPDATE ON leave_procedure_bindings
BEGIN
  SELECT RAISE(ABORT, 'leave_procedure_binding_immutable');
END;
CREATE TRIGGER leave_procedure_binding_immutable_delete
BEFORE DELETE ON leave_procedure_bindings
BEGIN
  SELECT RAISE(ABORT, 'leave_procedure_binding_immutable');
END;

CREATE TRIGGER leave_procedure_request_immutable
BEFORE UPDATE ON leave_requests
WHEN EXISTS (SELECT 1 FROM leave_procedure_bindings WHERE leave_request_id = OLD.id)
 AND (NEW.id IS NOT OLD.id
   OR NEW.employee_id IS NOT OLD.employee_id
   OR NEW.leave_type IS NOT OLD.leave_type
   OR NEW.start_date IS NOT OLD.start_date
   OR NEW.end_date IS NOT OLD.end_date
   OR NEW.days IS NOT OLD.days
   OR NEW.unit IS NOT OLD.unit
   OR NEW.hours IS NOT OLD.hours
   OR NEW.consumed_days IS NOT OLD.consumed_days
   OR NEW.reason IS NOT OLD.reason
   OR NEW.created_at IS NOT OLD.created_at OR OLD.status <> 'pending'
   OR NEW.status NOT IN ('approved', 'rejected'))
BEGIN
  SELECT RAISE(ABORT, 'leave_procedure_request_immutable');
END;

CREATE TRIGGER leave_procedure_request_requires_execution
BEFORE UPDATE ON leave_requests
WHEN EXISTS (SELECT 1 FROM leave_procedure_bindings WHERE leave_request_id = OLD.id)
 AND NOT EXISTS (
   SELECT 1 FROM leave_procedure_bindings binding
   JOIN system_cases workflow_case ON workflow_case.id = binding.case_id
   WHERE binding.leave_request_id = OLD.id
     AND ((NEW.status = 'rejected' AND workflow_case.status = 'rejected')
       OR (NEW.status = 'approved' AND workflow_case.status = 'approved' AND EXISTS (
         SELECT 1 FROM system_execution_authorizations authorization
         WHERE authorization.case_id = binding.case_id
           AND authorization.operation_key = 'leave.request.authorize'
           AND authorization.proposal_digest = binding.proposal_digest
           AND authorization.used_at IS NULL
       )))
 )
BEGIN
  SELECT RAISE(ABORT, 'leave_procedure_execution_required');
END;
