ALTER TABLE ringi_procedure_bindings ADD COLUMN previous_ringi_id INTEGER REFERENCES ringi_requests(id) ON DELETE RESTRICT;
DROP TRIGGER ringi_procedure_binding_matches_proposal;
CREATE UNIQUE INDEX ringi_resubmission_once ON ringi_procedure_bindings(previous_ringi_id) WHERE previous_ringi_id IS NOT NULL;

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
    AND request.created_at <= strftime('%Y-%m-%dT%H:%M:%fZ', proposal.created_at / 1000.0, 'unixepoch')
    AND definition.completion_operation_key = 'ringi.request.authorize'
    AND workflow_case.subject_context = 'ringi' AND workflow_case.subject_kind = 'request'
    AND workflow_case.subject_id = NEW.request_key AND workflow_case.subject_version = '1'
    AND workflow_case.status = 'pending'
    AND json_extract(proposal.body_json, '$.applicantId') IS request.applicant_id
    AND json_extract(proposal.body_json, '$.requestedApproverId') IS request.approver_id
    AND json_extract(proposal.body_json, '$.title') IS request.title
    AND json_extract(proposal.body_json, '$.amount') IS request.amount
    AND json_extract(proposal.body_json, '$.reason') IS request.reason
    AND (NEW.previous_ringi_id IS NULL OR EXISTS (
      SELECT 1 FROM ringi_procedure_bindings previous
      JOIN ringi_requests original ON original.id = previous.ringi_id
      JOIN system_cases previous_case ON previous_case.id = previous.case_id
      WHERE previous.ringi_id = NEW.previous_ringi_id AND previous.ringi_id <> NEW.ringi_id
        AND original.applicant_id = request.applicant_id AND previous_case.status = 'returned'
        AND previous_case.created_by_account_id = proposal.created_by_account_id
        AND previous_case.updated_at <= NEW.created_at
    ))
)
BEGIN
  SELECT RAISE(ABORT, 'ringi_procedure_proposal_mismatch');
END;
