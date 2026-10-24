CREATE TRIGGER company_organization_change_operations_command_immutable
BEFORE UPDATE OF request_fingerprint, actor_account_id, reason, evidence_references_json
ON company_organization_change_operations
BEGIN
  SELECT RAISE(ABORT, 'organization change command is immutable');
END;
