CREATE TRIGGER company_personnel_action_requests_immutable_proposal
BEFORE UPDATE ON company_personnel_action_requests
WHEN
  NEW.id IS NOT OLD.id
  OR NEW.application_id IS NOT OLD.application_id
  OR NEW.system_proposal_series_id IS NOT OLD.system_proposal_series_id
  OR NEW.kind IS NOT OLD.kind
  OR NEW.payload_json IS NOT OLD.payload_json
  OR NEW.payload_fingerprint IS NOT OLD.payload_fingerprint
  OR NEW.requested_by_employee_id IS NOT OLD.requested_by_employee_id
  OR NEW.base_employee_revision IS NOT OLD.base_employee_revision
  OR NEW.base_organization_revision IS NOT OLD.base_organization_revision
  OR NEW.created_at IS NOT OLD.created_at
  OR NEW.subject_snapshot_json IS NOT OLD.subject_snapshot_json
  OR NEW.target_department_code IS NOT OLD.target_department_code
  OR OLD.withdrawn_at IS NOT NULL
  OR OLD.applied_action_id IS NOT NULL
  OR (NEW.withdrawn_at IS NOT NULL AND NEW.applied_action_id IS NOT NULL)
BEGIN
  SELECT RAISE(ABORT, 'personnel action request proposal is immutable');
END;
