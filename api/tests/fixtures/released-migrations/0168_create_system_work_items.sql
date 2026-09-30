CREATE TABLE system_work_items (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 300),
  instructions TEXT NOT NULL CHECK (length(trim(instructions)) BETWEEN 1 AND 10000),
  acceptance_criteria TEXT NOT NULL CHECK (length(trim(acceptance_criteria)) BETWEEN 1 AND 10000),
  created_by_account_id TEXT NOT NULL REFERENCES system_accounts(id) ON DELETE RESTRICT,
  created_by_principal_id TEXT NOT NULL REFERENCES system_principals(id) ON DELETE RESTRICT,
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  due_at INTEGER CHECK (due_at IS NULL OR due_at >= created_at),
  previous_revision_id TEXT REFERENCES system_work_item_revisions(command_id) ON DELETE RESTRICT
);

CREATE TABLE system_work_item_revisions (
  sequence INTEGER PRIMARY KEY AUTOINCREMENT,
  work_item_id TEXT NOT NULL REFERENCES system_work_items(id) ON DELETE RESTRICT,
  revision INTEGER NOT NULL CHECK (revision BETWEEN 1 AND 9007199254740991),
  command_id TEXT NOT NULL UNIQUE,
  action TEXT NOT NULL CHECK (action IN ('create', 'accept', 'submit', 'approve', 'return', 'request_handover', 'accept_handover', 'decline_handover', 'cancel')),
  state TEXT NOT NULL CHECK (state IN ('offered', 'active', 'review_pending', 'completed', 'cancelled')),
  actor_account_id TEXT NOT NULL REFERENCES system_accounts(id) ON DELETE RESTRICT,
  actor_principal_id TEXT NOT NULL REFERENCES system_principals(id) ON DELETE RESTRICT,
  accountable_account_id TEXT NOT NULL REFERENCES system_accounts(id) ON DELETE RESTRICT,
  accountable_principal_id TEXT NOT NULL REFERENCES system_principals(id) ON DELETE RESTRICT,
  assignee_account_id TEXT NOT NULL REFERENCES system_accounts(id) ON DELETE RESTRICT,
  assignee_principal_id TEXT NOT NULL REFERENCES system_principals(id) ON DELETE RESTRICT,
  recorded_at INTEGER NOT NULL CHECK (recorded_at >= 0),
  snapshot_json TEXT NOT NULL CHECK (json_valid(snapshot_json) AND json_type(snapshot_json) = 'object' AND length(snapshot_json) <= 100000),
  audit_event_id TEXT NOT NULL UNIQUE REFERENCES system_audit_events(event_id) ON DELETE RESTRICT,
  UNIQUE (work_item_id, revision)
);
CREATE INDEX system_work_items_accountable_idx ON system_work_item_revisions(accountable_account_id, work_item_id, revision);
CREATE INDEX system_work_items_assignee_idx ON system_work_item_revisions(assignee_account_id, work_item_id, revision);

CREATE TABLE system_work_evidence (
  attachment_id TEXT PRIMARY KEY NOT NULL REFERENCES system_attachments(id) ON DELETE RESTRICT,
  work_item_id TEXT NOT NULL REFERENCES system_work_items(id) ON DELETE RESTRICT,
  plaintext_sha256 TEXT NOT NULL CHECK (length(plaintext_sha256) = 64 AND plaintext_sha256 NOT GLOB '*[^0-9a-f]*'),
  submitted_by_account_id TEXT NOT NULL REFERENCES system_accounts(id) ON DELETE RESTRICT,
  command_id TEXT NOT NULL REFERENCES system_work_item_revisions(command_id) ON DELETE RESTRICT,
  created_at INTEGER NOT NULL CHECK (created_at >= 0)
);
CREATE INDEX system_work_evidence_work_idx ON system_work_evidence(work_item_id, attachment_id);

DROP TRIGGER IF EXISTS system_work_revision_insert;
CREATE TRIGGER system_work_revision_insert BEFORE INSERT ON system_work_item_revisions
BEGIN
  SELECT RAISE(ABORT, 'work_item_shape_invalid')
  WHERE NOT COALESCE((
    (SELECT count(*) FROM json_each(NEW.snapshot_json)) = 23
    AND NOT EXISTS (SELECT 1 FROM json_each(NEW.snapshot_json) WHERE key NOT IN ('id','revision','commandId','requestDigest','action','title','instructions','acceptanceCriteria','dueAt','previousRevisionId','createdBy','createdAt','assignee','accountable','state','result','handover','actor','authentication','recovery','reason','recordedAt','auditEventId'))
    AND json_extract(NEW.snapshot_json, '$.id') IS NEW.work_item_id
    AND json_extract(NEW.snapshot_json, '$.revision') IS NEW.revision
    AND json_extract(NEW.snapshot_json, '$.commandId') IS NEW.command_id
    AND json_extract(NEW.snapshot_json, '$.action') IS NEW.action
    AND json_extract(NEW.snapshot_json, '$.state') IS NEW.state
    AND json_extract(NEW.snapshot_json, '$.actor.accountId') IS NEW.actor_account_id
    AND json_extract(NEW.snapshot_json, '$.actor.principalId') IS NEW.actor_principal_id
    AND json_extract(NEW.snapshot_json, '$.accountable.accountId') IS NEW.accountable_account_id
    AND json_extract(NEW.snapshot_json, '$.accountable.principalId') IS NEW.accountable_principal_id
    AND json_extract(NEW.snapshot_json, '$.assignee.accountId') IS NEW.assignee_account_id
    AND json_extract(NEW.snapshot_json, '$.assignee.principalId') IS NEW.assignee_principal_id
    AND json_extract(NEW.snapshot_json, '$.auditEventId') IS NEW.audit_event_id
    AND json_extract(NEW.snapshot_json, '$.recordedAt') IS strftime('%Y-%m-%dT%H:%M:%fZ', NEW.recorded_at / 1000.0, 'unixepoch')
    AND json_type(NEW.snapshot_json, '$.requestDigest') IS 'text' AND length(json_extract(NEW.snapshot_json, '$.requestDigest')) = 64 AND json_extract(NEW.snapshot_json, '$.requestDigest') NOT GLOB '*[^0-9a-f]*'
    AND json_type(NEW.snapshot_json, '$.recovery') IN ('true','false')
    AND json_type(NEW.snapshot_json, '$.reason') IS 'text' AND length(trim(json_extract(NEW.snapshot_json, '$.reason'))) BETWEEN 1 AND 1000
    AND json_type(NEW.snapshot_json, '$.authentication') IS 'object' AND (SELECT count(*) FROM json_each(NEW.snapshot_json, '$.authentication')) = 3
    AND json_type(NEW.snapshot_json, '$.authentication.tokenVersion') IS 'integer' AND json_extract(NEW.snapshot_json, '$.authentication.tokenVersion') BETWEEN 0 AND 9007199254740991
    AND (json_type(NEW.snapshot_json, '$.authentication.credentialId') IS 'null' OR (json_type(NEW.snapshot_json, '$.authentication.credentialId') IS 'text' AND length(json_extract(NEW.snapshot_json, '$.authentication.credentialId')) BETWEEN 1 AND 255))
    AND (json_type(NEW.snapshot_json, '$.authentication.stepUpGrantId') IS 'null' OR (json_type(NEW.snapshot_json, '$.authentication.stepUpGrantId') IS 'text' AND length(json_extract(NEW.snapshot_json, '$.authentication.stepUpGrantId')) BETWEEN 1 AND 255))
    AND json_type(NEW.snapshot_json, '$.createdBy') IS 'object' AND (SELECT count(*) FROM json_each(NEW.snapshot_json, '$.createdBy')) = 3
    AND json_type(NEW.snapshot_json, '$.createdBy.kind') IS 'text' AND json_extract(NEW.snapshot_json, '$.createdBy.kind') IN ('human')
    AND json_type(NEW.snapshot_json, '$.createdBy.accountId') IS 'text' AND length(trim(json_extract(NEW.snapshot_json, '$.createdBy.accountId'))) BETWEEN 1 AND 255
    AND json_type(NEW.snapshot_json, '$.createdBy.principalId') IS 'text' AND length(trim(json_extract(NEW.snapshot_json, '$.createdBy.principalId'))) BETWEEN 1 AND 255
    AND json_type(NEW.snapshot_json, '$.actor') IS 'object' AND (SELECT count(*) FROM json_each(NEW.snapshot_json, '$.actor')) = 3
    AND json_type(NEW.snapshot_json, '$.actor.kind') IS 'text' AND json_extract(NEW.snapshot_json, '$.actor.kind') IN ('human','agent')
    AND json_type(NEW.snapshot_json, '$.actor.accountId') IS 'text' AND length(trim(json_extract(NEW.snapshot_json, '$.actor.accountId'))) BETWEEN 1 AND 255
    AND json_type(NEW.snapshot_json, '$.actor.principalId') IS 'text' AND length(trim(json_extract(NEW.snapshot_json, '$.actor.principalId'))) BETWEEN 1 AND 255
    AND json_type(NEW.snapshot_json, '$.assignee') IS 'object' AND (SELECT count(*) FROM json_each(NEW.snapshot_json, '$.assignee')) = 3
    AND json_type(NEW.snapshot_json, '$.assignee.kind') IS 'text' AND json_extract(NEW.snapshot_json, '$.assignee.kind') IN ('human','agent')
    AND json_type(NEW.snapshot_json, '$.assignee.accountId') IS 'text' AND length(trim(json_extract(NEW.snapshot_json, '$.assignee.accountId'))) BETWEEN 1 AND 255
    AND json_type(NEW.snapshot_json, '$.assignee.principalId') IS 'text' AND length(trim(json_extract(NEW.snapshot_json, '$.assignee.principalId'))) BETWEEN 1 AND 255
    AND json_type(NEW.snapshot_json, '$.accountable') IS 'object' AND (SELECT count(*) FROM json_each(NEW.snapshot_json, '$.accountable')) = 3
    AND json_type(NEW.snapshot_json, '$.accountable.kind') IS 'text' AND json_extract(NEW.snapshot_json, '$.accountable.kind') IN ('human')
    AND json_type(NEW.snapshot_json, '$.accountable.accountId') IS 'text' AND length(trim(json_extract(NEW.snapshot_json, '$.accountable.accountId'))) BETWEEN 1 AND 255
    AND json_type(NEW.snapshot_json, '$.accountable.principalId') IS 'text' AND length(trim(json_extract(NEW.snapshot_json, '$.accountable.principalId'))) BETWEEN 1 AND 255
    AND (json_type(NEW.snapshot_json, '$.result') IS 'null' OR (
    json_type(NEW.snapshot_json, '$.result') IS 'object'
    AND (SELECT count(*) FROM json_each(NEW.snapshot_json, '$.result')) = 6
    AND json_type(NEW.snapshot_json, '$.result.id') IS 'text'
    AND json_type(NEW.snapshot_json, '$.result.summary') IS 'text'
    AND length(trim(json_extract(NEW.snapshot_json, '$.result.summary'))) BETWEEN 1 AND 10000
    AND json_type(NEW.snapshot_json, '$.result.digest') IS 'text'
    AND length(json_extract(NEW.snapshot_json, '$.result.digest')) = 64
    AND json_extract(NEW.snapshot_json, '$.result.digest') NOT GLOB '*[^0-9a-f]*'
    AND json_type(NEW.snapshot_json, '$.result.evidence') IS 'array'
    AND json_array_length(NEW.snapshot_json, '$.result.evidence') <= 20
    AND (SELECT count(*) FROM json_each(NEW.snapshot_json, '$.result.evidence')) = (SELECT count(DISTINCT json_extract(value, '$.attachmentId')) FROM json_each(NEW.snapshot_json, '$.result.evidence'))
    AND NOT EXISTS (SELECT 1 FROM json_each(NEW.snapshot_json, '$.result.evidence') evidence
      WHERE evidence.type <> 'object' OR (SELECT count(*) FROM json_each(evidence.value)) <> 2
        OR json_type(evidence.value, '$.attachmentId') IS NOT 'text'
        OR length(trim(json_extract(evidence.value, '$.attachmentId'))) NOT BETWEEN 1 AND 64
        OR json_type(evidence.value, '$.sha256') IS NOT 'text'
        OR length(json_extract(evidence.value, '$.sha256')) <> 64
        OR json_extract(evidence.value, '$.sha256') GLOB '*[^0-9a-f]*')
    AND json_extract(NEW.snapshot_json, '$.result.submittedBy') IS json_extract(NEW.snapshot_json, '$.assignee')
    AND json_type(NEW.snapshot_json, '$.result.submittedAt') IS 'text'
    AND json_extract(NEW.snapshot_json, '$.result.submittedAt') >= json_extract(NEW.snapshot_json, '$.createdAt')
    AND json_extract(NEW.snapshot_json, '$.result.submittedAt') <= json_extract(NEW.snapshot_json, '$.recordedAt')
  ))
    AND (json_type(NEW.snapshot_json, '$.handover') IS 'null' OR (
    json_type(NEW.snapshot_json, '$.handover') IS 'object'
    AND (SELECT count(*) FROM json_each(NEW.snapshot_json, '$.handover')) = 5
    AND json_type(NEW.snapshot_json, '$.handover.id') IS 'text'
    AND json_type(NEW.snapshot_json, '$.handover.reason') IS 'text'
    AND length(trim(json_extract(NEW.snapshot_json, '$.handover.reason'))) BETWEEN 1 AND 1000
    AND json_type(NEW.snapshot_json, '$.handover.requestedAt') IS 'text'
    AND json_extract(NEW.snapshot_json, '$.handover.requestedAt') >= json_extract(NEW.snapshot_json, '$.createdAt')
    AND json_extract(NEW.snapshot_json, '$.handover.requestedAt') <= json_extract(NEW.snapshot_json, '$.recordedAt')
    AND json_type(NEW.snapshot_json, '$.handover.to') IS 'object'
    AND (SELECT count(*) FROM json_each(NEW.snapshot_json, '$.handover.to'))=3
    AND json_extract(NEW.snapshot_json, '$.handover.to.kind') IS 'human'
    AND json_extract(NEW.snapshot_json, '$.handover.requestedBy.kind') IS 'human'
    AND json_extract(NEW.snapshot_json, '$.handover.to') IS NOT json_extract(NEW.snapshot_json, '$.accountable')
  ))
  ), 0);
  SELECT RAISE(ABORT, 'work_item_revision_conflict')
  WHERE NOT COALESCE((
    NEW.revision = 1 + COALESCE((SELECT max(revision) FROM system_work_item_revisions WHERE work_item_id=NEW.work_item_id),0)
    AND NEW.recorded_at >= COALESCE((SELECT max(recorded_at) FROM system_work_item_revisions WHERE work_item_id=NEW.work_item_id),0)
  ), 0);
  SELECT RAISE(ABORT, 'work_item_definition_changed')
  WHERE NOT COALESCE((
    EXISTS (SELECT 1 FROM system_work_items item WHERE item.id=NEW.work_item_id AND json_extract(NEW.snapshot_json, '$.title') IS item.title AND json_extract(NEW.snapshot_json, '$.instructions') IS item.instructions AND json_extract(NEW.snapshot_json, '$.acceptanceCriteria') IS item.acceptance_criteria AND json_extract(NEW.snapshot_json, '$.createdBy.accountId') IS item.created_by_account_id AND json_extract(NEW.snapshot_json, '$.createdBy.principalId') IS item.created_by_principal_id AND json_extract(NEW.snapshot_json, '$.previousRevisionId') IS item.previous_revision_id AND json_extract(NEW.snapshot_json, '$.createdAt') IS strftime('%Y-%m-%dT%H:%M:%fZ', item.created_at / 1000.0, 'unixepoch') AND json_extract(NEW.snapshot_json, '$.dueAt') IS strftime('%Y-%m-%dT%H:%M:%fZ', item.due_at / 1000.0, 'unixepoch') AND item.created_at <= NEW.recorded_at)
  ), 0);
  SELECT RAISE(ABORT, 'work_item_actor_unavailable') WHERE NOT EXISTS (
    SELECT 1 FROM system_accounts account JOIN system_principals principal ON principal.account_id=account.id
    WHERE account.id=NEW.actor_account_id AND principal.id=NEW.actor_principal_id
      AND principal.kind=json_extract(NEW.snapshot_json,'$.actor.kind') AND principal.kind IN ('human','agent')
      AND account.status='active' AND account.closed_at IS NULL AND account.created_at<=NEW.recorded_at
      AND principal.created_at<=NEW.recorded_at AND account.token_version=json_extract(NEW.snapshot_json,'$.authentication.tokenVersion')
      AND ((principal.kind='human' AND json_type(NEW.snapshot_json,'$.authentication.credentialId') IS 'null')
        OR (principal.kind='agent' AND json_type(NEW.snapshot_json,'$.authentication.stepUpGrantId') IS 'null' AND EXISTS (
          SELECT 1 FROM system_machine_credentials credential
          WHERE credential.id=json_extract(NEW.snapshot_json,'$.authentication.credentialId') AND credential.principal_id=principal.id
            AND credential.status='active' AND credential.revoked_at IS NULL AND credential.created_at<=NEW.recorded_at
            AND (credential.expires_at IS NULL OR NEW.recorded_at<credential.expires_at))))
      AND (NEW.action IN ('create','accept','submit') OR (principal.kind='human' AND EXISTS (
        SELECT 1 FROM system_step_up_grants grant WHERE grant.id=json_extract(NEW.snapshot_json,'$.authentication.stepUpGrantId')
          AND grant.account_id=account.id AND grant.issued_at<=NEW.recorded_at AND NEW.recorded_at<grant.expires_at
          AND grant.revoked_at IS NULL AND grant.last_used_at<=NEW.recorded_at)))
  );
  SELECT RAISE(ABORT, 'work_item_permission_denied')
  WHERE NOT COALESCE((
    (EXISTS (SELECT 1 FROM (SELECT permission.permission_key FROM system_role_bindings binding
    JOIN system_iam_roles role ON role.id=binding.role_id
    JOIN system_iam_role_permissions permission ON permission.role_id=role.id
    WHERE binding.account_id=NEW.actor_account_id AND binding.resource_type IS NULL AND binding.resource_id IS NULL
      AND role.resource_type IS NULL AND role.created_at<=NEW.recorded_at AND binding.created_at<=NEW.recorded_at
      AND (binding.revoked_at IS NULL OR NEW.recorded_at<binding.revoked_at)) grants WHERE permission_key='system:admin') OR (EXISTS (SELECT 1 FROM (SELECT permission.permission_key FROM system_role_bindings binding
    JOIN system_iam_roles role ON role.id=binding.role_id
    JOIN system_iam_role_permissions permission ON permission.role_id=role.id
    WHERE binding.account_id=NEW.actor_account_id AND binding.resource_type IS NULL AND binding.resource_id IS NULL
      AND role.resource_type IS NULL AND role.created_at<=NEW.recorded_at AND binding.created_at<=NEW.recorded_at
      AND (binding.revoked_at IS NULL OR NEW.recorded_at<binding.revoked_at)) grants WHERE permission_key='system:work:read') AND EXISTS (SELECT 1 FROM (SELECT permission.permission_key FROM system_role_bindings binding
    JOIN system_iam_roles role ON role.id=binding.role_id
    JOIN system_iam_role_permissions permission ON permission.role_id=role.id
    WHERE binding.account_id=NEW.actor_account_id AND binding.resource_type IS NULL AND binding.resource_id IS NULL
      AND role.resource_type IS NULL AND role.created_at<=NEW.recorded_at AND binding.created_at<=NEW.recorded_at
      AND (binding.revoked_at IS NULL OR NEW.recorded_at<binding.revoked_at)) grants WHERE
      (NEW.action='create' AND permission_key='system:work:create')
      OR (NEW.action IN ('accept','submit') AND permission_key='system:work:perform')
      OR (NEW.action IN ('approve','return') AND permission_key='system:work:review')
      OR (NEW.action IN ('request_handover','accept_handover','decline_handover','cancel') AND permission_key='system:work:manage'))))
    AND (json_extract(NEW.snapshot_json, '$.recovery')=0 OR (NEW.action='request_handover' AND EXISTS (SELECT 1 FROM (SELECT permission.permission_key FROM system_role_bindings binding
    JOIN system_iam_roles role ON role.id=binding.role_id
    JOIN system_iam_role_permissions permission ON permission.role_id=role.id
    WHERE binding.account_id=NEW.actor_account_id AND binding.resource_type IS NULL AND binding.resource_id IS NULL
      AND role.resource_type IS NULL AND role.created_at<=NEW.recorded_at AND binding.created_at<=NEW.recorded_at
      AND (binding.revoked_at IS NULL OR NEW.recorded_at<binding.revoked_at)) grants WHERE permission_key='system:admin')))
  ), 0);
  SELECT RAISE(ABORT, 'work_item_transition_invalid')
  WHERE NOT COALESCE((
    (NEW.revision=1 AND NEW.action='create' AND NEW.state='offered' AND json_type(NEW.snapshot_json, '$.result') IS 'null' AND json_type(NEW.snapshot_json, '$.handover') IS 'null' AND json_extract(NEW.snapshot_json, '$.actor') IS json_extract(NEW.snapshot_json, '$.createdBy') AND json_extract(NEW.snapshot_json, '$.actor') IS json_extract(NEW.snapshot_json, '$.accountable') AND json_extract(NEW.snapshot_json, '$.createdAt') IS json_extract(NEW.snapshot_json, '$.recordedAt')) OR (NEW.revision>1 AND EXISTS (SELECT 1 FROM system_work_item_revisions previous WHERE previous.work_item_id=NEW.work_item_id AND previous.revision=NEW.revision-1 AND previous.state NOT IN ('completed','cancelled') AND json_extract(NEW.snapshot_json, '$.assignee') IS json_extract(previous.snapshot_json, '$.assignee') AND (json_type(previous.snapshot_json, '$.handover') IS 'null' OR NEW.action IN ('accept_handover','decline_handover','cancel') OR (NEW.action='request_handover' AND json_extract(NEW.snapshot_json, '$.recovery')=1)) AND (NEW.action='submit' OR json_extract(NEW.snapshot_json, '$.result') IS json_extract(previous.snapshot_json, '$.result')) AND (NEW.action='accept_handover' OR json_extract(NEW.snapshot_json, '$.accountable') IS json_extract(previous.snapshot_json, '$.accountable')) AND (NEW.action='request_handover' OR json_type(NEW.snapshot_json, '$.handover') IS 'null') AND (
      (NEW.action='accept' AND previous.state='offered' AND NEW.state='active' AND json_extract(NEW.snapshot_json, '$.actor') IS json_extract(previous.snapshot_json, '$.assignee'))
      OR (NEW.action='submit' AND previous.state='active' AND NEW.state='review_pending' AND json_extract(NEW.snapshot_json, '$.actor') IS json_extract(previous.snapshot_json, '$.assignee') AND json_type(NEW.snapshot_json, '$.result') IS 'object' AND json_extract(NEW.snapshot_json, '$.result.id') IS NEW.command_id AND json_extract(NEW.snapshot_json, '$.result.submittedAt') IS json_extract(NEW.snapshot_json, '$.recordedAt'))
      OR (NEW.action='approve' AND previous.state='review_pending' AND NEW.state='completed' AND json_extract(NEW.snapshot_json, '$.actor') IS json_extract(previous.snapshot_json, '$.accountable') AND json_type(NEW.snapshot_json, '$.result') IS 'object' AND NEW.actor_account_id<>NEW.assignee_account_id AND NEW.actor_principal_id<>NEW.assignee_principal_id)
      OR (NEW.action='return' AND previous.state='review_pending' AND NEW.state='active' AND json_extract(NEW.snapshot_json, '$.actor') IS json_extract(previous.snapshot_json, '$.accountable') AND json_type(NEW.snapshot_json, '$.result') IS 'object')
      OR (NEW.action='request_handover' AND NEW.state=previous.state AND (json_extract(NEW.snapshot_json, '$.actor') IS json_extract(previous.snapshot_json, '$.accountable') OR json_extract(NEW.snapshot_json, '$.recovery')=1) AND json_extract(NEW.snapshot_json, '$.recovery') IS (json_type(previous.snapshot_json, '$.handover') IS 'object' OR json_extract(NEW.snapshot_json, '$.actor') IS NOT json_extract(previous.snapshot_json, '$.accountable')) AND json_type(NEW.snapshot_json, '$.handover') IS 'object' AND json_extract(NEW.snapshot_json, '$.handover.id') IS NEW.command_id AND json_extract(NEW.snapshot_json, '$.handover.requestedAt') IS json_extract(NEW.snapshot_json, '$.recordedAt') AND json_extract(NEW.snapshot_json, '$.handover.requestedBy') IS json_extract(NEW.snapshot_json, '$.actor') AND json_extract(NEW.snapshot_json, '$.handover.reason') IS json_extract(NEW.snapshot_json, '$.reason'))
      OR (NEW.action='accept_handover' AND NEW.state=previous.state AND json_type(previous.snapshot_json, '$.handover') IS 'object' AND json_extract(NEW.snapshot_json, '$.actor') IS json_extract(previous.snapshot_json, '$.handover.to') AND json_extract(NEW.snapshot_json, '$.accountable') IS json_extract(previous.snapshot_json, '$.handover.to'))
      OR (NEW.action='decline_handover' AND NEW.state=previous.state AND json_type(previous.snapshot_json, '$.handover') IS 'object' AND json_extract(NEW.snapshot_json, '$.actor') IS json_extract(previous.snapshot_json, '$.handover.to'))
      OR (NEW.action='cancel' AND NEW.state='cancelled' AND json_extract(NEW.snapshot_json, '$.actor') IS json_extract(previous.snapshot_json, '$.accountable')))))
  ), 0);
  SELECT RAISE(ABORT, 'work_item_recipient_unavailable')
  WHERE NOT COALESCE((
    NOT (NEW.action='create') OR EXISTS (SELECT 1 FROM system_accounts account JOIN system_principals principal ON principal.account_id=account.id WHERE account.id=json_extract(NEW.snapshot_json, '$.assignee.accountId') AND principal.id=json_extract(NEW.snapshot_json, '$.assignee.principalId') AND principal.kind=json_extract(NEW.snapshot_json, '$.assignee.kind') AND principal.kind IN ('human','agent') AND account.status='active' AND account.closed_at IS NULL AND account.created_at<=NEW.recorded_at AND principal.created_at<=NEW.recorded_at)
  ), 0);
  SELECT RAISE(ABORT, 'work_item_recipient_unavailable')
  WHERE NOT COALESCE((
    NOT (NEW.action='request_handover') OR EXISTS (SELECT 1 FROM system_accounts account JOIN system_principals principal ON principal.account_id=account.id WHERE account.id=json_extract(NEW.snapshot_json, '$.handover.to.accountId') AND principal.id=json_extract(NEW.snapshot_json, '$.handover.to.principalId') AND principal.kind=json_extract(NEW.snapshot_json, '$.handover.to.kind') AND principal.kind = 'human' AND account.status='active' AND account.closed_at IS NULL AND account.created_at<=NEW.recorded_at AND principal.created_at<=NEW.recorded_at)
  ), 0);
  SELECT RAISE(ABORT, 'work_item_previous_unavailable')
  WHERE NOT COALESCE((
    NEW.action<>'create' OR json_type(NEW.snapshot_json, '$.previousRevisionId') IS 'null' OR EXISTS (SELECT 1 FROM system_work_item_revisions prior WHERE prior.command_id=json_extract(NEW.snapshot_json, '$.previousRevisionId') AND prior.state IN ('completed','cancelled') AND prior.work_item_id<>NEW.work_item_id AND prior.recorded_at<=NEW.recorded_at AND (prior.accountable_account_id=NEW.actor_account_id AND prior.accountable_principal_id=NEW.actor_principal_id OR prior.assignee_account_id=NEW.actor_account_id AND prior.assignee_principal_id=NEW.actor_principal_id OR EXISTS (SELECT 1 FROM (SELECT permission.permission_key FROM system_role_bindings binding
    JOIN system_iam_roles role ON role.id=binding.role_id
    JOIN system_iam_role_permissions permission ON permission.role_id=role.id
    WHERE binding.account_id=NEW.actor_account_id AND binding.resource_type IS NULL AND binding.resource_id IS NULL
      AND role.resource_type IS NULL AND role.created_at<=NEW.recorded_at AND binding.created_at<=NEW.recorded_at
      AND (binding.revoked_at IS NULL OR NEW.recorded_at<binding.revoked_at)) grants WHERE permission_key='system:admin')))
  ), 0);
  SELECT RAISE(ABORT, 'work_item_audit_invalid')
  WHERE NOT COALESCE((
    EXISTS (SELECT 1 FROM system_audit_events audit WHERE audit.event_id=NEW.audit_event_id
    AND audit.actor_account_id=NEW.actor_account_id AND audit.action='system.work.'||NEW.action
    AND audit.target_type='system:work-item' AND audit.target_id=NEW.work_item_id
    AND audit.outcome='succeeded' AND audit.reason_code IS NULL AND audit.metadata_json IS NULL
    AND audit.occurred_at=NEW.recorded_at AND audit.after_json IS NEW.snapshot_json
    AND audit.before_json IS (SELECT snapshot_json FROM system_work_item_revisions WHERE work_item_id=NEW.work_item_id AND revision=NEW.revision-1)
    AND json_extract(audit.authorization_json,'$.principal_id') IS NEW.actor_principal_id
    AND json_extract(audit.authorization_json,'$.principal_kind') IS json_extract(NEW.snapshot_json, '$.actor.kind')
    AND json_extract(audit.authorization_json,'$.token_version') IS json_extract(NEW.snapshot_json, '$.authentication.tokenVersion')
    AND json_extract(audit.authorization_json,'$.credential_id') IS json_extract(NEW.snapshot_json, '$.authentication.credentialId')
    AND json_extract(audit.authorization_json,'$.step_up_grant_id') IS json_extract(NEW.snapshot_json, '$.authentication.stepUpGrantId')
    AND json_extract(audit.authorization_json,'$.recovery') IS json_extract(NEW.snapshot_json, '$.recovery'))
  ), 0);
  SELECT RAISE(ABORT, 'work_item_evidence_unavailable')
  WHERE NOT COALESCE((
    NEW.action NOT IN ('submit','approve') OR NOT EXISTS (
    SELECT 1 FROM json_each(NEW.snapshot_json,'$.result.evidence') evidence WHERE NOT EXISTS (
      SELECT 1 FROM system_attachments attachment WHERE attachment.id=json_extract(evidence.value,'$.attachmentId')
        AND attachment.plaintext_sha256=json_extract(evidence.value,'$.sha256') AND attachment.erased_at IS NULL
        AND attachment.wrapped_dek IS NOT NULL AND attachment.created_at<=NEW.recorded_at
        AND ((NEW.action='submit' AND attachment.owner_account_id=NEW.actor_account_id
          AND attachment.status='pending' AND attachment.linked_at IS NULL
          AND NOT EXISTS (SELECT 1 FROM system_work_evidence claim WHERE claim.attachment_id=attachment.id))
        OR (attachment.status='linked' AND attachment.linked_at IS NOT NULL AND EXISTS (
          SELECT 1 FROM system_work_evidence claim WHERE claim.attachment_id=attachment.id
            AND claim.work_item_id=NEW.work_item_id AND claim.plaintext_sha256=attachment.plaintext_sha256)))))
  ), 0);
END;

DROP TRIGGER IF EXISTS system_work_evidence_insert;
CREATE TRIGGER system_work_evidence_insert BEFORE INSERT ON system_work_evidence
BEGIN
  SELECT RAISE(ABORT, 'work_item_evidence_unavailable') WHERE NOT EXISTS (
    SELECT 1 FROM system_work_item_revisions revision, json_each(revision.snapshot_json,'$.result.evidence') evidence
    JOIN system_attachments attachment ON attachment.id=json_extract(evidence.value,'$.attachmentId')
    WHERE revision.command_id=NEW.command_id AND revision.work_item_id=NEW.work_item_id AND revision.action='submit'
      AND revision.actor_account_id=NEW.submitted_by_account_id AND revision.recorded_at=NEW.created_at
      AND attachment.id=NEW.attachment_id AND attachment.owner_account_id=NEW.submitted_by_account_id
      AND attachment.status='pending' AND attachment.linked_at IS NULL AND attachment.erased_at IS NULL
      AND attachment.wrapped_dek IS NOT NULL AND attachment.plaintext_sha256=NEW.plaintext_sha256
      AND json_extract(evidence.value,'$.sha256')=NEW.plaintext_sha256 AND attachment.created_at<=NEW.created_at
  );
END;

DROP TRIGGER IF EXISTS system_work_submit_evidence;
CREATE TRIGGER system_work_submit_evidence AFTER INSERT ON system_work_item_revisions
WHEN NEW.action='submit'
BEGIN
  INSERT INTO system_work_evidence (attachment_id,work_item_id,plaintext_sha256,submitted_by_account_id,command_id,created_at)
  SELECT json_extract(evidence.value,'$.attachmentId'),NEW.work_item_id,json_extract(evidence.value,'$.sha256'),
    NEW.actor_account_id,NEW.command_id,NEW.recorded_at
  FROM json_each(NEW.snapshot_json,'$.result.evidence') evidence
  WHERE NOT EXISTS (SELECT 1 FROM system_work_evidence claim WHERE claim.attachment_id=json_extract(evidence.value,'$.attachmentId'));
  UPDATE system_attachments SET status='linked',linked_at=NEW.recorded_at
  WHERE id IN (SELECT attachment_id FROM system_work_evidence WHERE command_id=NEW.command_id)
    AND status='pending' AND linked_at IS NULL AND erased_at IS NULL;
  SELECT RAISE(ABORT, 'work_item_evidence_unavailable') WHERE EXISTS (
    SELECT 1 FROM json_each(NEW.snapshot_json,'$.result.evidence') evidence WHERE NOT EXISTS (
      SELECT 1 FROM system_work_evidence claim JOIN system_attachments attachment ON attachment.id=claim.attachment_id
      WHERE claim.attachment_id=json_extract(evidence.value,'$.attachmentId') AND claim.work_item_id=NEW.work_item_id
        AND claim.plaintext_sha256=json_extract(evidence.value,'$.sha256')
        AND attachment.plaintext_sha256=claim.plaintext_sha256 AND attachment.status='linked'
        AND attachment.linked_at IS NOT NULL AND attachment.erased_at IS NULL AND attachment.wrapped_dek IS NOT NULL));
END;

DROP TRIGGER IF EXISTS system_work_items_update;
CREATE TRIGGER system_work_items_update BEFORE UPDATE ON system_work_items
BEGIN
  SELECT RAISE(ABORT, 'work item records are immutable');
END;

DROP TRIGGER IF EXISTS system_work_items_delete;
CREATE TRIGGER system_work_items_delete BEFORE DELETE ON system_work_items
BEGIN
  SELECT RAISE(ABORT, 'work item records are immutable');
END;

DROP TRIGGER IF EXISTS system_work_item_revisions_update;
CREATE TRIGGER system_work_item_revisions_update BEFORE UPDATE ON system_work_item_revisions
BEGIN
  SELECT RAISE(ABORT, 'work item records are immutable');
END;

DROP TRIGGER IF EXISTS system_work_item_revisions_delete;
CREATE TRIGGER system_work_item_revisions_delete BEFORE DELETE ON system_work_item_revisions
BEGIN
  SELECT RAISE(ABORT, 'work item records are immutable');
END;

DROP TRIGGER IF EXISTS system_work_evidence_update;
CREATE TRIGGER system_work_evidence_update BEFORE UPDATE ON system_work_evidence
BEGIN
  SELECT RAISE(ABORT, 'work item records are immutable');
END;

DROP TRIGGER IF EXISTS system_work_evidence_delete;
CREATE TRIGGER system_work_evidence_delete BEFORE DELETE ON system_work_evidence
BEGIN
  SELECT RAISE(ABORT, 'work item records are immutable');
END;
