CREATE TABLE system_attachment_preservations (
  id TEXT PRIMARY KEY,
  attachment_id TEXT NOT NULL,
  plaintext_sha256 TEXT NOT NULL CHECK (length(plaintext_sha256) = 64),
  kind TEXT NOT NULL CHECK (kind IN ('hold', 'retention')),
  retain_until INTEGER,
  reason TEXT NOT NULL CHECK (length(trim(reason)) BETWEEN 1 AND 1000),
  created_by_account_id TEXT NOT NULL,
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  created_audit_event_id TEXT NOT NULL UNIQUE REFERENCES system_audit_events(event_id),
  revision INTEGER NOT NULL CHECK (revision IN (1, 2)),
  release_operation_id TEXT UNIQUE,
  released_by_account_id TEXT,
  released_at INTEGER,
  release_reason TEXT,
  release_audit_event_id TEXT UNIQUE REFERENCES system_audit_events(event_id),
  CHECK ((kind = 'hold' AND retain_until IS NULL) OR (kind = 'retention' AND retain_until IS NOT NULL AND retain_until > created_at)),
  CHECK ((revision = 1 AND release_operation_id IS NULL AND released_by_account_id IS NULL AND released_at IS NULL AND release_reason IS NULL AND release_audit_event_id IS NULL)
    OR (revision = 2 AND kind = 'hold' AND release_operation_id IS NOT NULL AND released_by_account_id IS NOT NULL AND released_at IS NOT NULL AND released_at >= created_at AND release_reason IS NOT NULL AND length(trim(release_reason)) BETWEEN 1 AND 1000 AND release_audit_event_id IS NOT NULL))
);
CREATE INDEX system_attachment_preservations_target_idx ON system_attachment_preservations(attachment_id, id);

CREATE TRIGGER system_attachment_preservations_insert
BEFORE INSERT ON system_attachment_preservations
BEGIN
  SELECT RAISE(ABORT, 'attachment_preservation_target_unavailable')
  WHERE NEW.revision <> 1 OR NOT EXISTS (
    SELECT 1 FROM system_attachments WHERE id = NEW.attachment_id AND status IN ('uploading', 'pending', 'linked')
      AND wrapped_dek IS NOT NULL AND plaintext_sha256 = NEW.plaintext_sha256 AND created_at <= NEW.created_at
  );
  SELECT RAISE(ABORT, 'attachment_preservation_audit_missing')
  WHERE NOT EXISTS (
    SELECT 1 FROM system_audit_events WHERE event_id = NEW.created_audit_event_id
      AND actor_account_id = NEW.created_by_account_id AND action = 'system.attachment.preservation.created'
      AND target_type = 'system:attachment-preservation' AND target_id = NEW.id AND outcome = 'succeeded'
      AND occurred_at = NEW.created_at AND before_json IS NULL
      AND json_extract(after_json, '$.id') = NEW.id AND json_extract(after_json, '$.attachmentId') = NEW.attachment_id
      AND json_extract(after_json, '$.sha256') = NEW.plaintext_sha256 AND json_extract(after_json, '$.kind') = NEW.kind
      AND json_extract(after_json, '$.reason') = NEW.reason AND json_extract(after_json, '$.revision') = 1
      AND json_extract(after_json, '$.retainUntil') IS strftime('%Y-%m-%dT%H:%M:%fZ', NEW.retain_until / 1000.0, 'unixepoch')
      AND json_extract(after_json, '$.actorAccountId') = NEW.created_by_account_id
      AND json_extract(after_json, '$.createdAt') = strftime('%Y-%m-%dT%H:%M:%fZ', NEW.created_at / 1000.0, 'unixepoch')
      AND json_extract(after_json, '$.auditEventId') = NEW.created_audit_event_id
      AND json_type(after_json, '$.release') = 'null'
  );
END;

CREATE TRIGGER system_attachment_preservations_update
BEFORE UPDATE ON system_attachment_preservations
BEGIN
  SELECT RAISE(ABORT, 'attachment_preservation_immutable')
  WHERE OLD.revision <> 1 OR NEW.revision <> 2 OR OLD.kind <> 'hold'
    OR NEW.id IS NOT OLD.id OR NEW.attachment_id IS NOT OLD.attachment_id OR NEW.plaintext_sha256 IS NOT OLD.plaintext_sha256
    OR NEW.kind IS NOT OLD.kind OR NEW.retain_until IS NOT OLD.retain_until OR NEW.reason IS NOT OLD.reason
    OR NEW.created_by_account_id IS NOT OLD.created_by_account_id OR NEW.created_at IS NOT OLD.created_at
    OR NEW.created_audit_event_id IS NOT OLD.created_audit_event_id;
  SELECT RAISE(ABORT, 'attachment_preservation_audit_missing')
  WHERE NOT EXISTS (
    SELECT 1 FROM system_audit_events WHERE event_id = NEW.release_audit_event_id
      AND actor_account_id = NEW.released_by_account_id AND action = 'system.attachment.preservation.released'
      AND target_type = 'system:attachment-preservation' AND target_id = NEW.id AND outcome = 'succeeded'
      AND occurred_at = NEW.released_at AND json_extract(before_json, '$.revision') = 1
      AND json_extract(after_json, '$.id') = NEW.id AND json_extract(after_json, '$.revision') = 2
      AND json_extract(after_json, '$.release.operationId') = NEW.release_operation_id
      AND json_extract(after_json, '$.release.reason') = NEW.release_reason
      AND json_extract(after_json, '$.attachmentId') = NEW.attachment_id
      AND json_extract(after_json, '$.sha256') = NEW.plaintext_sha256
      AND json_extract(after_json, '$.kind') = NEW.kind
      AND json_extract(after_json, '$.retainUntil') IS NULL
      AND json_extract(after_json, '$.reason') = NEW.reason
      AND json_extract(after_json, '$.actorAccountId') = NEW.created_by_account_id
      AND json_extract(after_json, '$.createdAt') = strftime('%Y-%m-%dT%H:%M:%fZ', NEW.created_at / 1000.0, 'unixepoch')
      AND json_extract(after_json, '$.auditEventId') = NEW.created_audit_event_id
      AND json_extract(after_json, '$.release.actorAccountId') = NEW.released_by_account_id
      AND json_extract(after_json, '$.release.at') = strftime('%Y-%m-%dT%H:%M:%fZ', NEW.released_at / 1000.0, 'unixepoch')
      AND json_extract(after_json, '$.release.auditEventId') = NEW.release_audit_event_id
      AND json_extract(before_json, '$.id') = OLD.id
      AND json_extract(before_json, '$.attachmentId') = OLD.attachment_id
      AND json_extract(before_json, '$.sha256') = OLD.plaintext_sha256
      AND json_extract(before_json, '$.kind') = OLD.kind
      AND json_type(before_json, '$.retainUntil') = 'null'
      AND json_extract(before_json, '$.reason') = OLD.reason
      AND json_extract(before_json, '$.actorAccountId') = OLD.created_by_account_id
      AND json_extract(before_json, '$.createdAt') = strftime('%Y-%m-%dT%H:%M:%fZ', OLD.created_at / 1000.0, 'unixepoch')
      AND json_extract(before_json, '$.auditEventId') = OLD.created_audit_event_id
      AND json_type(before_json, '$.release') = 'null'
  );
END;

CREATE TRIGGER system_attachment_preservations_delete
BEFORE DELETE ON system_attachment_preservations
BEGIN
  SELECT RAISE(ABORT, 'attachment_preservation_immutable');
END;

CREATE TRIGGER system_attachment_preservation_erase_guard
BEFORE UPDATE ON system_attachments
WHEN NEW.status = 'erased' OR NEW.wrapped_dek IS NULL
BEGIN
  SELECT RAISE(ABORT, 'attachment_preserved')
  WHERE EXISTS (
    SELECT 1 FROM system_attachment_preservations WHERE attachment_id = OLD.id
      AND ((kind = 'hold' AND released_at IS NULL)
        OR (kind = 'retention' AND (NEW.erased_at IS NULL OR retain_until > NEW.erased_at)))
  );
END;

CREATE TRIGGER system_attachment_preservation_delete_guard
BEFORE DELETE ON system_attachments
BEGIN
  SELECT RAISE(ABORT, 'attachment_preserved')
  WHERE EXISTS (
    SELECT 1 FROM system_attachment_preservations WHERE attachment_id = OLD.id
      AND ((kind = 'hold' AND released_at IS NULL)
        OR (kind = 'retention' AND (OLD.status <> 'erased' OR OLD.erased_at IS NULL OR retain_until > OLD.erased_at)))
  );
END;

CREATE TRIGGER system_attachment_preservation_content_guard
BEFORE UPDATE ON system_attachments
WHEN NEW.id IS NOT OLD.id OR NEW.owner_account_id IS NOT OLD.owner_account_id
  OR NEW.object_key IS NOT OLD.object_key OR NEW.plaintext_sha256 IS NOT OLD.plaintext_sha256
  OR NEW.content_type IS NOT OLD.content_type OR NEW.byte_size IS NOT OLD.byte_size
  OR NEW.file_name IS NOT OLD.file_name OR NEW.content_iv IS NOT OLD.content_iv OR NEW.created_at IS NOT OLD.created_at
  OR (NEW.status <> 'erased' AND (NEW.wrapped_dek IS NOT OLD.wrapped_dek OR NEW.wrapped_dek_iv IS NOT OLD.wrapped_dek_iv OR NEW.kek_version IS NOT OLD.kek_version))
BEGIN
  SELECT RAISE(ABORT, 'attachment_preserved_content_immutable')
  WHERE EXISTS (SELECT 1 FROM system_attachment_preservations WHERE attachment_id = OLD.id);
END;

CREATE TRIGGER system_attachment_preservation_identity_guard
BEFORE INSERT ON system_attachments
WHEN EXISTS (SELECT 1 FROM system_attachment_preservations WHERE attachment_id = NEW.id)
BEGIN
  SELECT RAISE(ABORT, 'attachment_preserved_identity_immutable');
END;
