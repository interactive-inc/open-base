CREATE TRIGGER company_personnel_action_requests_system_proposal_insert
BEFORE INSERT ON company_personnel_action_requests
WHEN
  NEW.system_proposal_series_id IS NULL
  OR NEW.payload_fingerprint IS NULL
  OR NOT EXISTS (
    SELECT 1
    FROM system_proposal_numbers number
    JOIN system_proposal_series series ON series.id = number.series_id
    WHERE number.number = NEW.application_id
      AND number.series_id = NEW.system_proposal_series_id
      AND series.procedure_key = 'personnel_action_request'
  )
  OR NOT EXISTS (
    SELECT 1
    FROM system_proposals proposal
    WHERE proposal.series_id = NEW.system_proposal_series_id
      AND proposal.body_json = NEW.payload_json
  )
BEGIN
  SELECT RAISE(ABORT, 'personnel action requires matching System proposal');
END;
