CREATE TABLE ringi_procedure_bindings (
  request_key TEXT PRIMARY KEY NOT NULL CHECK (length(request_key) BETWEEN 1 AND 255),
  ringi_id INTEGER NOT NULL UNIQUE REFERENCES ringi_requests(id) ON DELETE RESTRICT,
  application_id INTEGER NOT NULL UNIQUE REFERENCES system_proposal_numbers(number) ON DELETE RESTRICT,
  series_id TEXT NOT NULL UNIQUE REFERENCES system_proposal_series(id) ON DELETE RESTRICT,
  case_id TEXT NOT NULL UNIQUE REFERENCES system_cases(id) ON DELETE RESTRICT,
  proposal_digest TEXT NOT NULL CHECK (length(proposal_digest) = 64),
  created_at INTEGER NOT NULL CHECK (created_at >= 0)
);

CREATE TRIGGER ringi_procedure_binding_matches_proposal
BEFORE INSERT ON ringi_procedure_bindings
WHEN NOT EXISTS (
  SELECT 1 FROM ringi_requests request
  JOIN system_proposal_numbers number ON number.number = NEW.application_id AND number.series_id = NEW.series_id
  JOIN system_proposals proposal ON proposal.series_id = NEW.series_id AND proposal.version = 1
  JOIN system_proposal_cases association ON association.proposal_id = proposal.id AND association.case_id = NEW.case_id
  JOIN system_cases workflow_case ON workflow_case.id = NEW.case_id
  JOIN system_procedure_definition_revisions definition
    ON definition.procedure_key = proposal.procedure_key AND definition.revision = proposal.procedure_revision
  WHERE request.id = NEW.ringi_id AND request.status = 'pending'
    AND request.applicant_id <> request.approver_id
    AND proposal.digest = NEW.proposal_digest AND proposal.created_at = NEW.created_at
    AND request.created_at = strftime('%Y-%m-%dT%H:%M:%fZ', proposal.created_at / 1000.0, 'unixepoch')
    AND definition.completion_operation_key = 'ringi.request.authorize'
    AND workflow_case.subject_context = 'ringi' AND workflow_case.subject_kind = 'request'
    AND workflow_case.subject_id = NEW.request_key AND workflow_case.subject_version = '1'
    AND workflow_case.status = 'pending'
    AND json_extract(proposal.body_json, '$.applicantId') IS request.applicant_id
    AND json_extract(proposal.body_json, '$.requestedApproverId') IS request.approver_id
    AND json_extract(proposal.body_json, '$.title') IS request.title
    AND json_extract(proposal.body_json, '$.amount') IS request.amount
    AND json_extract(proposal.body_json, '$.reason') IS request.reason
)
BEGIN
  SELECT RAISE(ABORT, 'ringi_procedure_proposal_mismatch');
END;

CREATE TRIGGER ringi_procedure_binding_immutable_update
BEFORE UPDATE ON ringi_procedure_bindings
BEGIN
  SELECT RAISE(ABORT, 'ringi_procedure_binding_immutable');
END;

CREATE TRIGGER ringi_procedure_binding_immutable_delete
BEFORE DELETE ON ringi_procedure_bindings
BEGIN
  SELECT RAISE(ABORT, 'ringi_procedure_binding_immutable');
END;

CREATE TRIGGER ringi_procedure_request_immutable
BEFORE UPDATE ON ringi_requests
WHEN EXISTS (SELECT 1 FROM ringi_procedure_bindings WHERE ringi_id = OLD.id)
 AND (NEW.id IS NOT OLD.id OR NEW.applicant_id IS NOT OLD.applicant_id
   OR NEW.approver_id IS NOT OLD.approver_id OR NEW.title IS NOT OLD.title
   OR NEW.amount IS NOT OLD.amount OR NEW.reason IS NOT OLD.reason
   OR NEW.created_at IS NOT OLD.created_at OR OLD.status <> 'pending'
   OR NEW.status NOT IN ('approved', 'rejected'))
BEGIN
  SELECT RAISE(ABORT, 'ringi_procedure_request_immutable');
END;

CREATE TRIGGER ringi_procedure_request_requires_execution
BEFORE UPDATE ON ringi_requests
WHEN EXISTS (SELECT 1 FROM ringi_procedure_bindings WHERE ringi_id = OLD.id)
 AND NOT EXISTS (
   SELECT 1 FROM ringi_procedure_bindings binding
   JOIN system_cases workflow_case ON workflow_case.id = binding.case_id
   WHERE binding.ringi_id = OLD.id
     AND ((NEW.status = 'rejected' AND workflow_case.status = 'rejected')
       OR (NEW.status = 'approved' AND workflow_case.status = 'approved' AND EXISTS (
         SELECT 1 FROM system_execution_authorizations authorization
         WHERE authorization.case_id = binding.case_id
           AND authorization.operation_key = 'ringi.request.authorize'
           AND authorization.proposal_digest = binding.proposal_digest
           AND authorization.used_at IS NULL
           AND NEW.decided_at = strftime('%Y-%m-%dT%H:%M:%fZ', authorization.granted_at / 1000.0, 'unixepoch')
       )))
 )
BEGIN
  SELECT RAISE(ABORT, 'ringi_procedure_execution_required');
END;
