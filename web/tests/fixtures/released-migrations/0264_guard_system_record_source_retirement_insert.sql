CREATE TRIGGER system_record_source_retirements_insert BEFORE INSERT ON system_record_source_retirements
BEGIN
  SELECT RAISE(ABORT,'record_source_retirement_execution_invalid') WHERE NOT EXISTS (
    SELECT 1 FROM system_execution_authorizations authorization
    JOIN system_cases workflow_case ON workflow_case.id=authorization.case_id
    JOIN system_proposal_cases link ON link.case_id=workflow_case.id
    JOIN system_proposals proposal ON proposal.id=link.proposal_id
    JOIN system_record_retirement_plans plan ON plan.id=NEW.plan_id
    JOIN system_record_source_freezes freeze ON freeze.id=NEW.freeze_id AND freeze.revision=1
    JOIN system_record_retirement_receipts receipt ON receipt.id=NEW.terminal_receipt_id
    WHERE authorization.id=NEW.execution_authorization_id AND authorization.case_id=NEW.case_id
      AND authorization.operation_key='system.record.retire' AND authorization.used_at IS NOT NULL
      AND authorization.granted_at<=authorization.used_at AND authorization.expires_at>authorization.used_at
      AND workflow_case.status='executed' AND workflow_case.proposal_digest=authorization.proposal_digest
      AND workflow_case.updated_at=authorization.used_at
      AND proposal.id=NEW.proposal_id AND proposal.digest=authorization.proposal_digest
      AND proposal.version IS json_extract(NEW.snapshot_json,'$.proposalVersion')
      AND proposal.digest IS json_extract(NEW.snapshot_json,'$.proposalDigest')
      AND proposal.created_by_account_id=authorization.granted_to_account_id
      AND authorization.granted_to_account_id IS json_extract(NEW.snapshot_json,'$.actorAccountId')
      AND json_extract(proposal.body_json,'$.operation')='system.record.retire'
      AND json_extract(proposal.body_json,'$.actorAccountId')=authorization.granted_to_account_id
      AND json_extract(proposal.body_json,'$.plan.id')=plan.id AND plan.freeze_id=freeze.id
      AND json_extract(proposal.body_json,'$.plan.freezeId')=freeze.id
      AND json_extract(proposal.body_json,'$.plan.sourceNamespace')=freeze.source_namespace
      AND json_extract(proposal.body_json,'$.plan.ownerContext')=freeze.owner_context
      AND json_extract(proposal.body_json,'$.planDigest')=plan.digest
      AND plan.digest IS json_extract(NEW.snapshot_json,'$.planDigest')
      AND json_extract(proposal.body_json,'$.terminalReceipt.id')=receipt.id AND receipt.plan_id=plan.id
      AND json_extract(proposal.body_json,'$.terminalReceiptDigest')=receipt.digest
      AND receipt.digest IS json_extract(NEW.snapshot_json,'$.terminalReceiptDigest')
      AND receipt.ordinal=(SELECT sum(json_extract(value,'$.pageCount')) FROM json_each(plan.snapshot_json,'$.coverage'))
      AND julianday(json_extract(receipt.snapshot_json,'$.checkedAt'))<=julianday(json_extract(NEW.snapshot_json,'$.finalizedAt'))
      AND strftime('%Y-%m-%dT%H:%M:%fZ',authorization.used_at/1000.0,'unixepoch') IS json_extract(NEW.snapshot_json,'$.finalizedAt')
  );
  SELECT RAISE(ABORT,'record_source_retirement_audit_missing') WHERE NOT EXISTS (
    SELECT 1 FROM system_audit_events audit WHERE audit.event_id=NEW.audit_event_id
      AND audit.action='system.record.source.retired' AND audit.target_type='system:record-source-retirement'
      AND audit.target_id=NEW.id AND audit.outcome='succeeded' AND audit.before_json IS NULL
      AND audit.after_json IS NEW.snapshot_json
      AND audit.actor_account_id IS json_extract(NEW.snapshot_json,'$.actorAccountId')
      AND json_extract(audit.authorization_json,'$.executionAuthorizationId') IS NEW.execution_authorization_id
      AND strftime('%Y-%m-%dT%H:%M:%fZ',audit.occurred_at/1000.0,'unixepoch') IS json_extract(NEW.snapshot_json,'$.finalizedAt')
  );
END;
