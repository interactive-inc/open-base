DROP TRIGGER system_proposal_cases_valid_insert;

CREATE TRIGGER system_proposal_cases_valid_insert
BEFORE INSERT ON system_proposal_cases
WHEN NOT EXISTS (
  SELECT 1
  FROM system_proposals AS proposal
  JOIN system_cases AS workflow_case ON workflow_case.id = NEW.case_id
  WHERE proposal.id = NEW.proposal_id
    AND (
      workflow_case.subject_context <> 'system'
      OR (
        workflow_case.subject_kind = 'proposal'
        AND workflow_case.subject_id = proposal.series_id
        AND workflow_case.subject_version = CAST(proposal.version AS TEXT)
      )
      OR (
        workflow_case.subject_context = 'system'
        AND workflow_case.subject_kind = 'record-preservation'
        AND workflow_case.subject_version = '1'
        AND json_extract(proposal.body_json, '$.operation') IS 'system.record.preserve'
        AND json_extract(proposal.body_json, '$.version') IS 1
        AND json_extract(proposal.body_json, '$.recordId') IS workflow_case.subject_id
      )
    )
    AND workflow_case.proposal_digest = proposal.digest
    AND workflow_case.created_by_account_id = proposal.created_by_account_id
    AND workflow_case.created_at = NEW.linked_at
)
BEGIN
  SELECT RAISE(ABORT, 'system proposal case does not match');
END;
