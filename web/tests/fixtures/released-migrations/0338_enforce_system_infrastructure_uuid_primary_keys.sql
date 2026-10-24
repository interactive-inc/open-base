-- System の基盤の table を UUID の主キーへ揃える (Issue )。
--
-- 対象: 添付と保全、保全した原記録、原記録の開示方針、撤去の停止・照合・計画・確定、外部連携（connector、
-- 連携の交換、外部の主張、照合）、job・outbox・inbox・dead letter、通知、作業項目と版と証拠、一括処理、
-- 操作の受領記録。
--
-- 主キーの値は既に UUID で採番しているため、値は変えずに UUID の CHECK を課す。UUID でない主キーが
-- 残っていれば作り直した table の CHECK で migration が止まる。本番に UUID でない値が無いことは事前に確かめた。
--
-- 形を変える table:
-- - 複合の主キー（照合の項目、照合の記録、撤去で残す添付、操作の受領記録）と、版を主キーに含む原記録の開示方針は、
--   新しい UUID の列を主キーにし、旧来の主キーの組は一意な属性として残す
-- - 作業項目の版は整数の連番の主キーをやめ、UUID の id を主キーにする。版の順序は (work_item_id, revision) が表す
-- - 一括処理の整数の主キーは UUID に置き換え、旧来の値を legacy_id に残す
-- - 通知の対象範囲と作業の証拠は、親（通知、添付）の主キーをそのまま主キーにしており、同じ値に UUID の CHECK を課す
--
-- 退避と削除は参照元から、作り直しは参照先から行う。外部キーは D1 の migration の transaction の終わりに検査する。
--
-- ALTER TABLE RENAME は trigger を含む全 schema を解析し直し、table ごとに数十 ms かかる。
-- 名前を変えずに行を退避し、同じ名前で作り直してから戻す。

PRAGMA defer_foreign_keys = true;

CREATE TABLE _system_infrastructure_uuid_primary_key_validation (
  resource TEXT PRIMARY KEY NOT NULL,
  source_count INTEGER NOT NULL,
  target_count INTEGER NOT NULL,
  orphan_count INTEGER NOT NULL,
  non_uuid_count INTEGER NOT NULL,
  blocked_count INTEGER NOT NULL,
  CHECK (source_count = target_count AND orphan_count = 0 AND non_uuid_count = 0 AND blocked_count = 0)
);

-- system_attachments
CREATE TABLE _system_attachments_id_map (
  old_id TEXT PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _system_attachments_id_map (old_id, new_id)
SELECT id, id
FROM system_attachments;

-- system_attachment_preservations
CREATE TABLE _system_attachment_preservations_id_map (
  old_id TEXT PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _system_attachment_preservations_id_map (old_id, new_id)
SELECT id, id
FROM system_attachment_preservations;

-- system_preserved_records
CREATE TABLE _system_preserved_records_id_map (
  old_id TEXT PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _system_preserved_records_id_map (old_id, new_id)
SELECT id, id
FROM system_preserved_records;

-- system_record_source_freezes
CREATE TABLE _system_record_source_freezes_id_map (
  old_id TEXT PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _system_record_source_freezes_id_map (old_id, new_id)
SELECT id, id
FROM system_record_source_freezes;

-- system_record_coverage_pages
CREATE TABLE _system_record_coverage_pages_id_map (
  old_id TEXT PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _system_record_coverage_pages_id_map (old_id, new_id)
SELECT id, id
FROM system_record_coverage_pages;

-- system_record_retirement_plans
CREATE TABLE _system_record_retirement_plans_id_map (
  old_id TEXT PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _system_record_retirement_plans_id_map (old_id, new_id)
SELECT id, id
FROM system_record_retirement_plans;

-- system_record_retirement_receipts
CREATE TABLE _system_record_retirement_receipts_id_map (
  old_id TEXT PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _system_record_retirement_receipts_id_map (old_id, new_id)
SELECT id, id
FROM system_record_retirement_receipts;

-- system_record_source_retirements
CREATE TABLE _system_record_source_retirements_id_map (
  old_id TEXT PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _system_record_source_retirements_id_map (old_id, new_id)
SELECT id, id
FROM system_record_source_retirements;

-- system_connectors
CREATE TABLE _system_connectors_id_map (
  old_id TEXT PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _system_connectors_id_map (old_id, new_id)
SELECT id, id
FROM system_connectors;

-- system_integration_exchanges
CREATE TABLE _system_integration_exchanges_id_map (
  old_id TEXT PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _system_integration_exchanges_id_map (old_id, new_id)
SELECT id, id
FROM system_integration_exchanges;

-- system_external_assertions
CREATE TABLE _system_external_assertions_id_map (
  old_id TEXT PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _system_external_assertions_id_map (old_id, new_id)
SELECT id, id
FROM system_external_assertions;

-- system_reconciliation_runs
CREATE TABLE _system_reconciliation_runs_id_map (
  old_id TEXT PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _system_reconciliation_runs_id_map (old_id, new_id)
SELECT id, id
FROM system_reconciliation_runs;

-- system_jobs
CREATE TABLE _system_jobs_id_map (
  old_id TEXT PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _system_jobs_id_map (old_id, new_id)
SELECT id, id
FROM system_jobs;

-- system_outbox_messages
CREATE TABLE _system_outbox_messages_id_map (
  old_id TEXT PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _system_outbox_messages_id_map (old_id, new_id)
SELECT id, id
FROM system_outbox_messages;

-- system_inbox_messages
CREATE TABLE _system_inbox_messages_id_map (
  old_id TEXT PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _system_inbox_messages_id_map (old_id, new_id)
SELECT id, id
FROM system_inbox_messages;

-- system_dead_letters
CREATE TABLE _system_dead_letters_id_map (
  old_id TEXT PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _system_dead_letters_id_map (old_id, new_id)
SELECT id, id
FROM system_dead_letters;

-- system_notification_messages
CREATE TABLE _system_notification_messages_id_map (
  old_id TEXT PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _system_notification_messages_id_map (old_id, new_id)
SELECT id, id
FROM system_notification_messages;

-- system_notification_deliveries
CREATE TABLE _system_notification_deliveries_id_map (
  old_id TEXT PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _system_notification_deliveries_id_map (old_id, new_id)
SELECT id, id
FROM system_notification_deliveries;

-- system_work_items
CREATE TABLE _system_work_items_id_map (
  old_id TEXT PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _system_work_items_id_map (old_id, new_id)
SELECT id, id
FROM system_work_items;

-- system_batch_jobs
CREATE TABLE _system_batch_jobs_id_map (
  old_id INTEGER PRIMARY KEY NOT NULL,
  new_id TEXT NOT NULL UNIQUE
);
INSERT INTO _system_batch_jobs_id_map (old_id, new_id)
SELECT id, lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))
FROM system_batch_jobs;

-- 参照元から順に行を退避して table を削除する。
CREATE TABLE "_stage_system_operation_receipts" AS SELECT * FROM system_operation_receipts;
DROP TABLE system_operation_receipts;
CREATE TABLE "_stage_system_batch_jobs" AS SELECT * FROM system_batch_jobs;
DROP TABLE system_batch_jobs;
CREATE TABLE "_stage_system_work_evidence" AS SELECT * FROM system_work_evidence;
DROP TABLE system_work_evidence;
CREATE TABLE "_stage_system_work_item_revisions" AS SELECT * FROM system_work_item_revisions;
DROP TABLE system_work_item_revisions;
CREATE TABLE "_stage_system_work_items" AS SELECT * FROM system_work_items;
DROP TABLE system_work_items;
CREATE TABLE "_stage_system_notification_resource_scopes" AS SELECT * FROM system_notification_resource_scopes;
DROP TABLE system_notification_resource_scopes;
CREATE TABLE "_stage_system_notification_deliveries" AS SELECT * FROM system_notification_deliveries;
DROP TABLE system_notification_deliveries;
CREATE TABLE "_stage_system_notification_messages" AS SELECT * FROM system_notification_messages;
DROP TABLE system_notification_messages;
CREATE TABLE "_stage_system_dead_letters" AS SELECT * FROM system_dead_letters;
DROP TABLE system_dead_letters;
CREATE TABLE "_stage_system_inbox_messages" AS SELECT * FROM system_inbox_messages;
DROP TABLE system_inbox_messages;
CREATE TABLE "_stage_system_outbox_messages" AS SELECT * FROM system_outbox_messages;
DROP TABLE system_outbox_messages;
CREATE TABLE "_stage_system_jobs" AS SELECT * FROM system_jobs;
DROP TABLE system_jobs;
CREATE TABLE "_stage_system_reconciliation_items" AS SELECT * FROM system_reconciliation_items;
DROP TABLE system_reconciliation_items;
CREATE TABLE "_stage_system_reconciliation_runs" AS SELECT * FROM system_reconciliation_runs;
DROP TABLE system_reconciliation_runs;
CREATE TABLE "_stage_system_external_assertions" AS SELECT * FROM system_external_assertions;
DROP TABLE system_external_assertions;
CREATE TABLE "_stage_system_integration_exchanges" AS SELECT * FROM system_integration_exchanges;
DROP TABLE system_integration_exchanges;
CREATE TABLE "_stage_system_connectors" AS SELECT * FROM system_connectors;
DROP TABLE system_connectors;
CREATE TABLE "_stage_system_record_source_retirements" AS SELECT * FROM system_record_source_retirements;
DROP TABLE system_record_source_retirements;
CREATE TABLE "_stage_system_record_retirement_attachment_pins" AS SELECT * FROM system_record_retirement_attachment_pins;
DROP TABLE system_record_retirement_attachment_pins;
CREATE TABLE "_stage_system_record_retirement_receipts" AS SELECT * FROM system_record_retirement_receipts;
DROP TABLE system_record_retirement_receipts;
CREATE TABLE "_stage_system_record_retirement_plans" AS SELECT * FROM system_record_retirement_plans;
DROP TABLE system_record_retirement_plans;
CREATE TABLE "_stage_system_record_coverage_entries" AS SELECT * FROM system_record_coverage_entries;
DROP TABLE system_record_coverage_entries;
CREATE TABLE "_stage_system_record_coverage_pages" AS SELECT * FROM system_record_coverage_pages;
DROP TABLE system_record_coverage_pages;
CREATE TABLE "_stage_system_record_source_freezes" AS SELECT * FROM system_record_source_freezes;
DROP TABLE system_record_source_freezes;
CREATE TABLE "_stage_system_preserved_records" AS SELECT * FROM system_preserved_records;
DROP TABLE system_preserved_records;
CREATE TABLE "_stage_system_record_disclosure_policies" AS SELECT * FROM system_record_disclosure_policies;
DROP TABLE system_record_disclosure_policies;
CREATE TABLE "_stage_system_attachment_preservations" AS SELECT * FROM system_attachment_preservations;
DROP TABLE system_attachment_preservations;
CREATE TABLE "_stage_system_attachments" AS SELECT * FROM system_attachments;
DROP TABLE system_attachments;

-- system_attachments
CREATE TABLE system_attachments (
  id TEXT PRIMARY KEY NOT NULL,
  owner_account_id TEXT NOT NULL,
  object_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL,
  content_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL,
  file_name TEXT NOT NULL,
  plaintext_sha256 TEXT NOT NULL,
  wrapped_dek TEXT,
  wrapped_dek_iv TEXT,
  content_iv TEXT NOT NULL,
  kek_version INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  linked_at INTEGER,
  erased_at INTEGER,
  CHECK (status IN ('uploading', 'pending', 'linked', 'erased')),
  CHECK (byte_size > 0),
  CHECK (kek_version > 0),
  CHECK (object_key LIKE 'att/%' AND length(object_key) <= 255),
  CHECK ((status = 'erased') = (wrapped_dek IS NULL)),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO system_attachments (id, owner_account_id, object_key, status, content_type, byte_size, file_name, plaintext_sha256, wrapped_dek, wrapped_dek_iv, content_iv, kek_version, created_at, linked_at, erased_at)
SELECT map.new_id,
       source.owner_account_id,
       source.object_key,
       source.status,
       source.content_type,
       source.byte_size,
       source.file_name,
       source.plaintext_sha256,
       source.wrapped_dek,
       source.wrapped_dek_iv,
       source.content_iv,
       source.kek_version,
       source.created_at,
       source.linked_at,
       source.erased_at
FROM "_stage_system_attachments" source
INNER JOIN _system_attachments_id_map map ON map.old_id = source.id;
INSERT INTO _system_infrastructure_uuid_primary_key_validation
SELECT 'system_attachments',
       (SELECT count(*) FROM "_stage_system_attachments"),
       (SELECT count(*) FROM system_attachments),
       0,
       (SELECT count(*) FROM system_attachments WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       0;
DROP TABLE "_stage_system_attachments";
CREATE INDEX idx_system_attachments_owner_status
  ON system_attachments (owner_account_id, status);
CREATE INDEX idx_system_attachments_created_at
  ON system_attachments (created_at);
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
CREATE TRIGGER system_attachments_retirement_frozen_insert BEFORE INSERT ON system_attachments
BEGIN
  SELECT RAISE(ABORT,'record_retirement_source_attachment_frozen') WHERE EXISTS (
    SELECT 1 FROM system_record_retirement_attachment_pins pin
    JOIN system_record_retirement_receipts receipt ON receipt.id=pin.receipt_id
    JOIN system_record_retirement_plans plan ON plan.id=receipt.plan_id
    JOIN system_record_source_freezes freeze ON freeze.id=plan.freeze_id AND freeze.revision=1
    JOIN system_attachments attachment ON attachment.id=pin.attachment_id
    WHERE attachment.id=NEW.id OR attachment.object_key=NEW.object_key
  );
END;
CREATE TRIGGER system_attachments_retirement_frozen_update BEFORE UPDATE ON system_attachments
BEGIN
  SELECT RAISE(ABORT,'record_retirement_source_attachment_frozen') WHERE EXISTS (
    SELECT 1 FROM system_record_retirement_attachment_pins pin
    JOIN system_record_retirement_receipts receipt ON receipt.id=pin.receipt_id
    JOIN system_record_retirement_plans plan ON plan.id=receipt.plan_id
    JOIN system_record_source_freezes freeze ON freeze.id=plan.freeze_id AND freeze.revision=1
    JOIN system_attachments attachment ON attachment.id=pin.attachment_id
    WHERE attachment.id=OLD.id OR attachment.id=NEW.id OR attachment.object_key=NEW.object_key
  );
END;
CREATE TRIGGER system_attachments_retirement_frozen_delete BEFORE DELETE ON system_attachments
BEGIN
  SELECT RAISE(ABORT,'record_retirement_source_attachment_frozen') WHERE EXISTS (
    SELECT 1 FROM system_record_retirement_attachment_pins pin
    JOIN system_record_retirement_receipts receipt ON receipt.id=pin.receipt_id
    JOIN system_record_retirement_plans plan ON plan.id=receipt.plan_id
    JOIN system_record_source_freezes freeze ON freeze.id=plan.freeze_id AND freeze.revision=1
    JOIN system_attachments attachment ON attachment.id=pin.attachment_id
    WHERE attachment.id=OLD.id
  );
END;

-- system_attachment_preservations
CREATE TABLE system_attachment_preservations (
  id TEXT PRIMARY KEY NOT NULL,
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
    OR (revision = 2 AND kind = 'hold' AND release_operation_id IS NOT NULL AND released_by_account_id IS NOT NULL AND released_at IS NOT NULL AND released_at >= created_at AND release_reason IS NOT NULL AND length(trim(release_reason)) BETWEEN 1 AND 1000 AND release_audit_event_id IS NOT NULL)),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO system_attachment_preservations (id, attachment_id, plaintext_sha256, kind, retain_until, reason, created_by_account_id, created_at, created_audit_event_id, revision, release_operation_id, released_by_account_id, released_at, release_reason, release_audit_event_id)
SELECT map.new_id,
       source.attachment_id,
       source.plaintext_sha256,
       source.kind,
       source.retain_until,
       source.reason,
       source.created_by_account_id,
       source.created_at,
       source.created_audit_event_id,
       source.revision,
       source.release_operation_id,
       source.released_by_account_id,
       source.released_at,
       source.release_reason,
       source.release_audit_event_id
FROM "_stage_system_attachment_preservations" source
INNER JOIN _system_attachment_preservations_id_map map ON map.old_id = source.id;
INSERT INTO _system_infrastructure_uuid_primary_key_validation
SELECT 'system_attachment_preservations',
       (SELECT count(*) FROM "_stage_system_attachment_preservations"),
       (SELECT count(*) FROM system_attachment_preservations),
       0,
       (SELECT count(*) FROM system_attachment_preservations WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       0;
DROP TABLE "_stage_system_attachment_preservations";
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

-- system_record_disclosure_policies
CREATE TABLE system_record_disclosure_policies (
  revision_id TEXT PRIMARY KEY NOT NULL,
  id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision > 0),
  record_id TEXT NOT NULL,
  audit_event_id TEXT NOT NULL UNIQUE REFERENCES system_audit_events(event_id),
  snapshot_json TEXT NOT NULL CHECK (json_valid(snapshot_json)),
  UNIQUE (id, revision),
  CHECK (json_extract(snapshot_json, '$.id') IS id),
  CHECK (json_extract(snapshot_json, '$.revision') IS revision),
  CHECK (json_extract(snapshot_json, '$.recordId') IS record_id),
  CHECK (json_extract(snapshot_json, '$.auditEventId') IS audit_event_id),
  CHECK (json_type(snapshot_json, '$.grants') IS 'array'),
  CHECK (json_extract(snapshot_json, '$.status') IS 'active' OR json_extract(snapshot_json, '$.status') IS 'revoked'),
  CHECK (julianday(json_extract(snapshot_json, '$.publishedAt')) IS NOT NULL),
  CHECK (length(revision_id) = 36 AND revision_id NOT GLOB '*[^0-9a-f-]*' AND substr(revision_id, 9, 1) = '-' AND substr(revision_id, 14, 1) = '-' AND substr(revision_id, 19, 1) = '-' AND substr(revision_id, 24, 1) = '-' AND length(replace(revision_id, '-', '')) = 32 AND substr(revision_id, 15, 1) GLOB '[1-8]' AND substr(revision_id, 20, 1) GLOB '[89ab]')
);
INSERT INTO system_record_disclosure_policies (revision_id, id, revision, record_id, audit_event_id, snapshot_json)
SELECT lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))),
       source.id,
       source.revision,
       source.record_id,
       source.audit_event_id,
       source.snapshot_json
FROM "_stage_system_record_disclosure_policies" source;
INSERT INTO _system_infrastructure_uuid_primary_key_validation
SELECT 'system_record_disclosure_policies',
       (SELECT count(*) FROM "_stage_system_record_disclosure_policies"),
       (SELECT count(*) FROM system_record_disclosure_policies),
       0,
       (SELECT count(*) FROM system_record_disclosure_policies WHERE NOT (length(revision_id) = 36 AND revision_id NOT GLOB '*[^0-9a-f-]*' AND substr(revision_id, 9, 1) = '-' AND substr(revision_id, 14, 1) = '-' AND substr(revision_id, 19, 1) = '-' AND substr(revision_id, 24, 1) = '-' AND length(replace(revision_id, '-', '')) = 32 AND substr(revision_id, 15, 1) GLOB '[1-8]' AND substr(revision_id, 20, 1) GLOB '[89ab]')),
       0;
DROP TABLE "_stage_system_record_disclosure_policies";
CREATE TRIGGER system_record_disclosure_publication_guard
BEFORE INSERT ON system_record_disclosure_policies
WHEN NEW.revision != COALESCE((SELECT MAX(revision) FROM system_record_disclosure_policies WHERE id = NEW.id), 0) + 1
  OR EXISTS (SELECT 1 FROM system_record_disclosure_policies p WHERE p.id = NEW.id AND (
    p.record_id != NEW.record_id OR julianday(json_extract(p.snapshot_json, '$.publishedAt')) > julianday(json_extract(NEW.snapshot_json, '$.publishedAt'))))
  OR NOT EXISTS (SELECT 1 FROM system_audit_events a WHERE a.event_id = NEW.audit_event_id
    AND a.action = 'system.record.disclosure_policy.published' AND a.target_type = 'system:record-disclosure-policy'
    AND a.target_id = NEW.id AND a.outcome = 'succeeded'
    AND a.actor_account_id = json_extract(NEW.snapshot_json, '$.actorAccountId')
    AND a.after_json = NEW.snapshot_json
    AND strftime('%Y-%m-%dT%H:%M:%fZ', a.occurred_at / 1000.0, 'unixepoch') = json_extract(NEW.snapshot_json, '$.publishedAt'))
BEGIN
  SELECT RAISE(ABORT, 'record_disclosure_publication_invalid');
END;
CREATE TRIGGER system_record_disclosure_prevent_update
BEFORE UPDATE ON system_record_disclosure_policies
BEGIN
  SELECT RAISE(ABORT, 'record_disclosure_history_immutable');
END;
CREATE TRIGGER system_record_disclosure_prevent_delete
BEFORE DELETE ON system_record_disclosure_policies
BEGIN
  SELECT RAISE(ABORT, 'record_disclosure_history_immutable');
END;
CREATE TRIGGER system_record_disclosure_policies_identity_update
BEFORE UPDATE OF id ON system_record_disclosure_policies
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- system_preserved_records
CREATE TABLE system_preserved_records (
  id TEXT PRIMARY KEY NOT NULL,
  attachment_id TEXT NOT NULL UNIQUE REFERENCES system_attachments(id),
  preservation_id TEXT NOT NULL UNIQUE REFERENCES system_attachment_preservations(id),
  disclosure_policy_id TEXT NOT NULL,
  disclosure_policy_revision INTEGER NOT NULL,
  audit_event_id TEXT NOT NULL UNIQUE REFERENCES system_audit_events(event_id),
  snapshot_json TEXT NOT NULL CHECK (json_valid(snapshot_json)),
  FOREIGN KEY (disclosure_policy_id, disclosure_policy_revision) REFERENCES system_record_disclosure_policies(id, revision),
  CHECK (json_extract(snapshot_json, '$.id') IS id),
  CHECK (json_extract(snapshot_json, '$.attachmentId') IS attachment_id),
  CHECK (json_extract(snapshot_json, '$.preservationId') IS preservation_id),
  CHECK (json_extract(snapshot_json, '$.disclosurePolicyId') IS disclosure_policy_id),
  CHECK (json_extract(snapshot_json, '$.disclosurePolicyRevision') IS disclosure_policy_revision),
  CHECK (json_extract(snapshot_json, '$.auditEventId') IS audit_event_id),
  CHECK (json_type(snapshot_json, '$.source') IS 'object'),
  CHECK (json_type(snapshot_json, '$.sourceAuthorizationRef') IS 'object'),
  CHECK (julianday(json_extract(snapshot_json, '$.source.capturedAt')) IS NOT NULL),
  CHECK (julianday(json_extract(snapshot_json, '$.finalizedAt')) IS NOT NULL),
  CHECK (julianday(json_extract(snapshot_json, '$.source.capturedAt')) <= julianday(json_extract(snapshot_json, '$.finalizedAt'))),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO system_preserved_records (id, attachment_id, preservation_id, disclosure_policy_id, disclosure_policy_revision, audit_event_id, snapshot_json)
SELECT map.new_id,
       source.attachment_id,
       source.preservation_id,
       source.disclosure_policy_id,
       source.disclosure_policy_revision,
       source.audit_event_id,
       source.snapshot_json
FROM "_stage_system_preserved_records" source
INNER JOIN _system_preserved_records_id_map map ON map.old_id = source.id;
INSERT INTO _system_infrastructure_uuid_primary_key_validation
SELECT 'system_preserved_records',
       (SELECT count(*) FROM "_stage_system_preserved_records"),
       (SELECT count(*) FROM system_preserved_records),
       0,
       (SELECT count(*) FROM system_preserved_records WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       0;
DROP TABLE "_stage_system_preserved_records";
CREATE INDEX system_preserved_records_source_idx ON system_preserved_records (
  json_extract(snapshot_json, '$.source.sourceNamespace'),
  json_extract(snapshot_json, '$.source.ownerContext'),
  json_extract(snapshot_json, '$.source.recordKind'),
  json_extract(snapshot_json, '$.source.recordId')
);
CREATE TRIGGER system_preserved_record_prevent_update
BEFORE UPDATE ON system_preserved_records
BEGIN
  SELECT RAISE(ABORT, 'preserved_record_immutable');
END;
CREATE TRIGGER system_preserved_record_prevent_delete
BEFORE DELETE ON system_preserved_records
BEGIN
  SELECT RAISE(ABORT, 'preserved_record_immutable');
END;
CREATE TRIGGER system_preserved_record_insert_guard
BEFORE INSERT ON system_preserved_records
WHEN NOT EXISTS (
  SELECT 1 FROM system_attachments a JOIN system_attachment_preservations h ON h.attachment_id = a.id
  WHERE a.id = NEW.attachment_id AND h.id = NEW.preservation_id
    AND a.status = 'linked' AND a.content_type IN ('application/vnd.record-preservation+json', 'application/vnd.record-preservation+binary')
    AND a.plaintext_sha256 = json_extract(NEW.snapshot_json, '$.attachmentDigest')
    AND h.plaintext_sha256 = a.plaintext_sha256 AND h.released_at IS NULL
    AND h.created_by_account_id = json_extract(NEW.snapshot_json, '$.actorAccountId')
    AND strftime('%Y-%m-%dT%H:%M:%fZ', h.created_at / 1000.0, 'unixepoch') = json_extract(NEW.snapshot_json, '$.finalizedAt')
    AND (h.kind = 'hold' OR h.retain_until > h.created_at))
  OR NOT EXISTS (SELECT 1 FROM system_record_disclosure_policies p
    WHERE p.id = NEW.disclosure_policy_id AND p.revision = NEW.disclosure_policy_revision
      AND p.record_id = NEW.id AND json_extract(p.snapshot_json, '$.status') = 'active'
      AND julianday(json_extract(p.snapshot_json, '$.publishedAt')) <= julianday(json_extract(NEW.snapshot_json, '$.finalizedAt'))
      AND NOT EXISTS (SELECT 1 FROM system_record_disclosure_policies later WHERE later.id = p.id AND later.revision > p.revision))
  OR NOT EXISTS (SELECT 1 FROM system_audit_events a WHERE a.event_id = NEW.audit_event_id
    AND a.action = 'system.record.preserved' AND a.target_type = 'system:preserved-record'
    AND a.target_id = NEW.id AND a.outcome = 'succeeded'
    AND a.actor_account_id = json_extract(NEW.snapshot_json, '$.actorAccountId')
    AND a.after_json = NEW.snapshot_json
    AND strftime('%Y-%m-%dT%H:%M:%fZ', a.occurred_at / 1000.0, 'unixepoch') = json_extract(NEW.snapshot_json, '$.finalizedAt'))
BEGIN
  SELECT RAISE(ABORT, 'preserved_record_dependencies_invalid');
END;

-- system_record_source_freezes
CREATE TABLE system_record_source_freezes (
  id TEXT PRIMARY KEY NOT NULL,
  source_namespace TEXT NOT NULL CHECK (length(source_namespace) BETWEEN 1 AND 255),
  owner_context TEXT NOT NULL CHECK (length(owner_context) BETWEEN 1 AND 100),
  revision INTEGER NOT NULL CHECK (revision IN (1, 2)),
  created_audit_event_id TEXT NOT NULL UNIQUE REFERENCES system_audit_events(event_id),
  release_audit_event_id TEXT UNIQUE REFERENCES system_audit_events(event_id),
  snapshot_json TEXT NOT NULL CHECK (json_valid(snapshot_json)),
  CHECK (json_extract(snapshot_json, '$.id') IS id),
  CHECK (json_extract(snapshot_json, '$.sourceNamespace') IS source_namespace),
  CHECK (json_extract(snapshot_json, '$.ownerContext') IS owner_context),
  CHECK (json_extract(snapshot_json, '$.revision') IS revision),
  CHECK (json_extract(snapshot_json, '$.auditEventId') IS created_audit_event_id),
  CHECK (json_type(snapshot_json, '$.actorAccountId') IS 'text'
    AND length(trim(json_extract(snapshot_json, '$.actorAccountId'))) BETWEEN 1 AND 255),
  CHECK (json_type(snapshot_json, '$.reason') IS 'text'
    AND length(trim(json_extract(snapshot_json, '$.reason'))) BETWEEN 1 AND 2000),
  CHECK (julianday(json_extract(snapshot_json, '$.createdAt')) IS NOT NULL
    AND julianday(json_extract(snapshot_json, '$.createdAt')) >= julianday('1970-01-01T00:00:00Z')),
  CHECK ((revision = 1 AND release_audit_event_id IS NULL AND json_type(snapshot_json, '$.release') IS 'null')
    OR (revision = 2 AND release_audit_event_id IS NOT NULL AND release_audit_event_id <> created_audit_event_id
      AND json_type(snapshot_json, '$.release') IS 'object'
      AND json_extract(snapshot_json, '$.release.auditEventId') IS release_audit_event_id
      AND json_type(snapshot_json, '$.release.actorAccountId') IS 'text'
      AND length(trim(json_extract(snapshot_json, '$.release.actorAccountId'))) BETWEEN 1 AND 255
      AND json_type(snapshot_json, '$.release.reason') IS 'text'
      AND length(trim(json_extract(snapshot_json, '$.release.reason'))) BETWEEN 1 AND 2000
      AND julianday(json_extract(snapshot_json, '$.release.at')) IS NOT NULL
      AND julianday(json_extract(snapshot_json, '$.release.at')) >= julianday(json_extract(snapshot_json, '$.createdAt')))),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO system_record_source_freezes (id, source_namespace, owner_context, revision, created_audit_event_id, release_audit_event_id, snapshot_json)
SELECT map.new_id,
       source.source_namespace,
       source.owner_context,
       source.revision,
       source.created_audit_event_id,
       source.release_audit_event_id,
       source.snapshot_json
FROM "_stage_system_record_source_freezes" source
INNER JOIN _system_record_source_freezes_id_map map ON map.old_id = source.id;
INSERT INTO _system_infrastructure_uuid_primary_key_validation
SELECT 'system_record_source_freezes',
       (SELECT count(*) FROM "_stage_system_record_source_freezes"),
       (SELECT count(*) FROM system_record_source_freezes),
       0,
       (SELECT count(*) FROM system_record_source_freezes WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       0;
DROP TABLE "_stage_system_record_source_freezes";
CREATE UNIQUE INDEX system_record_source_freezes_active_owner_idx
  ON system_record_source_freezes(owner_context) WHERE revision = 1;
CREATE TRIGGER system_record_source_freezes_insert
BEFORE INSERT ON system_record_source_freezes
BEGIN
  SELECT RAISE(ABORT, 'record_source_freeze_creation_invalid') WHERE NEW.revision <> 1
    OR EXISTS (SELECT 1 FROM system_record_source_freezes
      WHERE id = NEW.id OR (owner_context = NEW.owner_context AND revision = 1));
  SELECT RAISE(ABORT, 'record_source_freeze_audit_missing') WHERE NOT EXISTS (
    SELECT 1 FROM system_audit_events WHERE event_id = NEW.created_audit_event_id
      AND actor_account_id = json_extract(NEW.snapshot_json, '$.actorAccountId')
      AND action = 'system.record.source.freeze.created' AND target_type = 'system:record-source-freeze'
      AND target_id = NEW.id AND outcome = 'succeeded' AND before_json IS NULL
      AND after_json IS NEW.snapshot_json
      AND strftime('%Y-%m-%dT%H:%M:%fZ', occurred_at / 1000.0, 'unixepoch') IS json_extract(NEW.snapshot_json, '$.createdAt')
  );
END;
CREATE TRIGGER system_record_source_freezes_update
BEFORE UPDATE ON system_record_source_freezes
BEGIN
  SELECT RAISE(ABORT, 'record_source_freeze_immutable')
  WHERE OLD.revision <> 1 OR NEW.revision <> 2 OR NEW.id IS NOT OLD.id
    OR NEW.source_namespace IS NOT OLD.source_namespace OR NEW.owner_context IS NOT OLD.owner_context
    OR NEW.created_audit_event_id IS NOT OLD.created_audit_event_id
    OR json_remove(NEW.snapshot_json, '$.release', '$.revision') IS NOT json_remove(OLD.snapshot_json, '$.release', '$.revision');
  SELECT RAISE(ABORT, 'record_source_freeze_audit_missing') WHERE NOT EXISTS (
    SELECT 1 FROM system_audit_events WHERE event_id = NEW.release_audit_event_id
      AND actor_account_id = json_extract(NEW.snapshot_json, '$.release.actorAccountId')
      AND action = 'system.record.source.freeze.released' AND target_type = 'system:record-source-freeze'
      AND target_id = NEW.id AND outcome = 'succeeded'
      AND before_json IS OLD.snapshot_json AND after_json IS NEW.snapshot_json
      AND strftime('%Y-%m-%dT%H:%M:%fZ', occurred_at / 1000.0, 'unixepoch') IS json_extract(NEW.snapshot_json, '$.release.at')
  );
END;
CREATE TRIGGER system_record_source_freezes_delete
BEFORE DELETE ON system_record_source_freezes
BEGIN
  SELECT RAISE(ABORT, 'record_source_freeze_immutable');
END;
CREATE TRIGGER system_record_source_retirement_prevents_release BEFORE UPDATE ON system_record_source_freezes
WHEN EXISTS (SELECT 1 FROM system_record_source_retirements WHERE freeze_id=OLD.id)
BEGIN
  SELECT RAISE(ABORT,'record_source_already_retired');
END;

-- system_record_coverage_pages
CREATE TABLE system_record_coverage_pages (
  id TEXT PRIMARY KEY NOT NULL,
  freeze_id TEXT NOT NULL REFERENCES system_record_source_freezes(id),
  record_kind TEXT NOT NULL,
  sequence INTEGER NOT NULL CHECK(sequence > 0),
  digest TEXT NOT NULL CHECK(length(digest)=64 AND digest NOT GLOB '*[^0-9a-f]*'),
  previous_digest TEXT,
  after_cursor TEXT,
  next_cursor TEXT,
  audit_event_id TEXT NOT NULL UNIQUE REFERENCES system_audit_events(event_id),
  snapshot_json TEXT NOT NULL CHECK(json_valid(snapshot_json)),
  UNIQUE(freeze_id,record_kind,sequence),
  UNIQUE(freeze_id,record_kind,digest),
  CHECK(json_extract(snapshot_json,'$.id') IS id),
  CHECK(json_extract(snapshot_json,'$.freezeId') IS freeze_id),
  CHECK(json_extract(snapshot_json,'$.recordKind') IS record_kind),
  CHECK(json_extract(snapshot_json,'$.sequence') IS sequence),
  CHECK(json_extract(snapshot_json,'$.previousDigest') IS previous_digest),
  CHECK(json_extract(snapshot_json,'$.afterCursor') IS after_cursor),
  CHECK(json_extract(snapshot_json,'$.nextCursor') IS next_cursor),
  CHECK(json_type(snapshot_json,'$.records') IS 'array' AND json_array_length(snapshot_json,'$.records') <= 100),
  CHECK(next_cursor IS NULL OR (length(next_cursor)>0 AND next_cursor IS NOT after_cursor AND json_array_length(snapshot_json,'$.records')>0)),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO system_record_coverage_pages (id, freeze_id, record_kind, sequence, digest, previous_digest, after_cursor, next_cursor, audit_event_id, snapshot_json)
SELECT map.new_id,
       source.freeze_id,
       source.record_kind,
       source.sequence,
       source.digest,
       source.previous_digest,
       source.after_cursor,
       source.next_cursor,
       source.audit_event_id,
       source.snapshot_json
FROM "_stage_system_record_coverage_pages" source
INNER JOIN _system_record_coverage_pages_id_map map ON map.old_id = source.id;
INSERT INTO _system_infrastructure_uuid_primary_key_validation
SELECT 'system_record_coverage_pages',
       (SELECT count(*) FROM "_stage_system_record_coverage_pages"),
       (SELECT count(*) FROM system_record_coverage_pages),
       0,
       (SELECT count(*) FROM system_record_coverage_pages WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       0;
DROP TABLE "_stage_system_record_coverage_pages";
CREATE UNIQUE INDEX system_record_coverage_pages_cursor_idx
  ON system_record_coverage_pages(freeze_id,record_kind,after_cursor) WHERE after_cursor IS NOT NULL;
CREATE TRIGGER system_record_coverage_pages_insert BEFORE INSERT ON system_record_coverage_pages
BEGIN
  SELECT RAISE(ABORT,'record_coverage_page_conflict') WHERE EXISTS (
    SELECT 1 FROM system_record_coverage_pages WHERE id=NEW.id
      OR (freeze_id=NEW.freeze_id AND record_kind=NEW.record_kind AND sequence>=NEW.sequence)
  );
  SELECT RAISE(ABORT,'record_coverage_freeze_unavailable') WHERE NOT EXISTS (
    SELECT 1 FROM system_record_source_freezes WHERE id=NEW.freeze_id AND revision=1
      AND source_namespace IS json_extract(NEW.snapshot_json,'$.sourceNamespace')
      AND owner_context IS json_extract(NEW.snapshot_json,'$.ownerContext')
  );
  SELECT RAISE(ABORT,'record_coverage_page_gap') WHERE
    (NEW.sequence=1 AND (NEW.previous_digest IS NOT NULL OR NEW.after_cursor IS NOT NULL))
    OR (NEW.sequence>1 AND NOT EXISTS (
      SELECT 1 FROM system_record_coverage_pages p WHERE p.freeze_id=NEW.freeze_id
        AND p.record_kind=NEW.record_kind AND p.sequence=NEW.sequence-1
        AND p.digest IS NEW.previous_digest AND p.next_cursor IS NOT NULL AND p.next_cursor IS NEW.after_cursor
        AND julianday(json_extract(NEW.snapshot_json,'$.checkedAt')) >= julianday(json_extract(p.snapshot_json,'$.checkedAt'))
    ));
  SELECT RAISE(ABORT,'record_coverage_audit_missing') WHERE NOT EXISTS (
    SELECT 1 FROM system_audit_events a WHERE a.event_id=NEW.audit_event_id
      AND a.action='system.record.coverage.page.verified' AND a.target_type='system:record-coverage-page'
      AND a.target_id=NEW.id AND a.outcome='succeeded'
      AND a.actor_account_id IS json_extract(NEW.snapshot_json,'$.actorAccountId')
      AND a.after_json IS NEW.snapshot_json
      AND a.before_json IS (SELECT p.snapshot_json FROM system_record_coverage_pages p WHERE p.freeze_id=NEW.freeze_id AND p.record_kind=NEW.record_kind AND p.sequence=NEW.sequence-1)
      AND strftime('%Y-%m-%dT%H:%M:%fZ',a.occurred_at/1000.0,'unixepoch') IS json_extract(NEW.snapshot_json,'$.checkedAt')
  );
END;
CREATE TRIGGER system_record_coverage_pages_index AFTER INSERT ON system_record_coverage_pages
BEGIN
  INSERT INTO system_record_coverage_entries(page_id,freeze_id,record_kind,source_record_id,preserved_record_id)
    SELECT NEW.id,NEW.freeze_id,NEW.record_kind,json_extract(item.value,'$.source.recordId'),json_extract(item.value,'$.preservedRecordId')
    FROM json_each(NEW.snapshot_json,'$.records') item;
END;
CREATE TRIGGER system_record_coverage_pages_update BEFORE UPDATE ON system_record_coverage_pages
BEGIN
  SELECT RAISE(ABORT,'record_coverage_immutable');
END;
CREATE TRIGGER system_record_coverage_pages_delete BEFORE DELETE ON system_record_coverage_pages
BEGIN
  SELECT RAISE(ABORT,'record_coverage_immutable');
END;

-- system_record_coverage_entries
CREATE TABLE system_record_coverage_entries (
  -- 照合の trigger が行を足すため、主キーは列の既定値で採番する。
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  page_id TEXT NOT NULL REFERENCES system_record_coverage_pages(id),
  freeze_id TEXT NOT NULL REFERENCES system_record_source_freezes(id),
  record_kind TEXT NOT NULL,
  source_record_id TEXT NOT NULL,
  preserved_record_id TEXT NOT NULL REFERENCES system_preserved_records(id),
  UNIQUE(freeze_id,record_kind,source_record_id),
  UNIQUE(freeze_id,preserved_record_id),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO system_record_coverage_entries (id, page_id, freeze_id, record_kind, source_record_id, preserved_record_id)
SELECT lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))),
       source.page_id,
       source.freeze_id,
       source.record_kind,
       source.source_record_id,
       source.preserved_record_id
FROM "_stage_system_record_coverage_entries" source;
INSERT INTO _system_infrastructure_uuid_primary_key_validation
SELECT 'system_record_coverage_entries',
       (SELECT count(*) FROM "_stage_system_record_coverage_entries"),
       (SELECT count(*) FROM system_record_coverage_entries),
       0,
       (SELECT count(*) FROM system_record_coverage_entries WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       0;
DROP TABLE "_stage_system_record_coverage_entries";
CREATE TRIGGER system_record_coverage_entries_update BEFORE UPDATE ON system_record_coverage_entries
BEGIN
  SELECT RAISE(ABORT,'record_coverage_immutable');
END;
CREATE TRIGGER system_record_coverage_entries_delete BEFORE DELETE ON system_record_coverage_entries
BEGIN
  SELECT RAISE(ABORT,'record_coverage_immutable');
END;
CREATE TRIGGER system_record_coverage_entries_insert BEFORE INSERT ON system_record_coverage_entries
BEGIN
  SELECT RAISE(ABORT,'record_coverage_entry_duplicate') WHERE EXISTS (
    SELECT 1 FROM system_record_coverage_entries WHERE freeze_id=NEW.freeze_id
      AND ((record_kind=NEW.record_kind AND source_record_id=NEW.source_record_id) OR preserved_record_id=NEW.preserved_record_id)
  );
  SELECT RAISE(ABORT,'record_coverage_source_mismatch') WHERE NOT EXISTS (
    SELECT 1 FROM system_record_coverage_pages p, json_each(p.snapshot_json,'$.records') item
    JOIN system_preserved_records r ON r.id=NEW.preserved_record_id
    WHERE p.id=NEW.page_id AND p.freeze_id=NEW.freeze_id AND p.record_kind=NEW.record_kind
      AND json_extract(item.value,'$.preservedRecordId') IS NEW.preserved_record_id
      AND json_extract(item.value,'$.source.recordId') IS NEW.source_record_id
      AND json_extract(item.value,'$.source.sourceNamespace') IS json_extract(p.snapshot_json,'$.sourceNamespace')
      AND json_extract(item.value,'$.source.ownerContext') IS json_extract(p.snapshot_json,'$.ownerContext')
      AND json_extract(item.value,'$.source.recordKind') IS NEW.record_kind
      AND json_extract(item.value,'$.source') IS json_extract(r.snapshot_json,'$.source')
  );
END;
CREATE TRIGGER system_record_coverage_entries_identity_update
BEFORE UPDATE OF id ON system_record_coverage_entries
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- system_record_retirement_plans
CREATE TABLE system_record_retirement_plans (
  id TEXT PRIMARY KEY NOT NULL,
  freeze_id TEXT NOT NULL REFERENCES system_record_source_freezes(id),
  digest TEXT NOT NULL CHECK(length(digest)=64 AND digest NOT GLOB '*[^0-9a-f]*'),
  audit_event_id TEXT NOT NULL UNIQUE REFERENCES system_audit_events(event_id),
  snapshot_json TEXT NOT NULL CHECK(json_valid(snapshot_json)),
  CHECK(json_extract(snapshot_json,'$.id') IS id),
  CHECK(json_extract(snapshot_json,'$.freezeId') IS freeze_id),
  CHECK(json_extract(snapshot_json,'$.auditEventId') IS audit_event_id),
  CHECK(json_type(snapshot_json,'$.capability.recordKinds') IS 'array'),
  CHECK(json_array_length(snapshot_json,'$.capability.recordKinds') BETWEEN 1 AND 256),
  CHECK(json_type(snapshot_json,'$.coverage') IS 'array'),
  CHECK(json_array_length(snapshot_json,'$.coverage') IS json_array_length(snapshot_json,'$.capability.recordKinds')),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO system_record_retirement_plans (id, freeze_id, digest, audit_event_id, snapshot_json)
SELECT map.new_id,
       source.freeze_id,
       source.digest,
       source.audit_event_id,
       source.snapshot_json
FROM "_stage_system_record_retirement_plans" source
INNER JOIN _system_record_retirement_plans_id_map map ON map.old_id = source.id;
INSERT INTO _system_infrastructure_uuid_primary_key_validation
SELECT 'system_record_retirement_plans',
       (SELECT count(*) FROM "_stage_system_record_retirement_plans"),
       (SELECT count(*) FROM system_record_retirement_plans),
       0,
       (SELECT count(*) FROM system_record_retirement_plans WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       0;
DROP TABLE "_stage_system_record_retirement_plans";
CREATE TRIGGER system_record_retirement_plans_insert BEFORE INSERT ON system_record_retirement_plans
BEGIN
  SELECT RAISE(ABORT,'record_retirement_plan_conflict') WHERE EXISTS (
    SELECT 1 FROM system_record_retirement_plans WHERE id=NEW.id
  );
  SELECT RAISE(ABORT,'record_retirement_plan_freeze_unavailable') WHERE NOT EXISTS (
    SELECT 1 FROM system_record_source_freezes WHERE id=NEW.freeze_id AND revision=1
      AND source_namespace IS json_extract(NEW.snapshot_json,'$.sourceNamespace')
      AND owner_context IS json_extract(NEW.snapshot_json,'$.ownerContext')
      AND julianday(json_extract(snapshot_json,'$.createdAt')) <= julianday(json_extract(NEW.snapshot_json,'$.createdAt'))
  );
  SELECT RAISE(ABORT,'record_retirement_plan_coverage_invalid') WHERE EXISTS (
    SELECT 1 FROM json_each(NEW.snapshot_json,'$.coverage') c
    WHERE json_extract(c.value,'$.recordKind') IS NOT json_extract(NEW.snapshot_json,'$.capability.recordKinds[' || c.key || ']')
      OR NOT EXISTS (
        SELECT 1 FROM system_record_coverage_pages p
        WHERE p.id IS json_extract(c.value,'$.terminalPageId') AND p.freeze_id=NEW.freeze_id
          AND p.record_kind IS json_extract(c.value,'$.recordKind') AND p.next_cursor IS NULL
          AND p.digest IS json_extract(c.value,'$.terminalDigest')
          AND p.sequence IS json_extract(c.value,'$.pageCount')
          AND json_extract(p.snapshot_json,'$.purpose') IS json_extract(NEW.snapshot_json,'$.purpose')
          AND julianday(json_extract(p.snapshot_json,'$.checkedAt')) <= julianday(json_extract(NEW.snapshot_json,'$.createdAt'))
          AND (SELECT count(*) FROM system_record_coverage_entries e WHERE e.freeze_id=NEW.freeze_id AND e.record_kind=p.record_kind)
            IS json_extract(c.value,'$.recordCount')
      )
  );
  SELECT RAISE(ABORT,'record_retirement_plan_coverage_invalid') WHERE
    (SELECT count(DISTINCT json_extract(value,'$.recordKind')) FROM json_each(NEW.snapshot_json,'$.coverage'))
      <> json_array_length(NEW.snapshot_json,'$.coverage');
  SELECT RAISE(ABORT,'record_retirement_plan_audit_missing') WHERE NOT EXISTS (
    SELECT 1 FROM system_audit_events a WHERE a.event_id=NEW.audit_event_id
      AND a.action='system.record.retirement.plan.created' AND a.target_type='system:record-retirement-plan'
      AND a.target_id=NEW.id AND a.outcome='succeeded' AND a.before_json IS NULL
      AND a.actor_account_id IS json_extract(NEW.snapshot_json,'$.actorAccountId')
      AND a.after_json IS NEW.snapshot_json
      AND strftime('%Y-%m-%dT%H:%M:%fZ',a.occurred_at/1000.0,'unixepoch') IS json_extract(NEW.snapshot_json,'$.createdAt')
  );
END;
CREATE TRIGGER system_record_retirement_plans_update BEFORE UPDATE ON system_record_retirement_plans
BEGIN
  SELECT RAISE(ABORT,'record_retirement_plan_immutable');
END;
CREATE TRIGGER system_record_retirement_plans_delete BEFORE DELETE ON system_record_retirement_plans
BEGIN
  SELECT RAISE(ABORT,'record_retirement_plan_immutable');
END;

-- system_record_retirement_receipts
CREATE TABLE system_record_retirement_receipts (
  id TEXT PRIMARY KEY NOT NULL,
  plan_id TEXT NOT NULL REFERENCES system_record_retirement_plans(id),
  ordinal INTEGER NOT NULL CHECK(ordinal > 0),
  digest TEXT NOT NULL CHECK(length(digest)=64 AND digest NOT GLOB '*[^0-9a-f]*'),
  coverage_page_id TEXT NOT NULL REFERENCES system_record_coverage_pages(id),
  audit_event_id TEXT NOT NULL UNIQUE REFERENCES system_audit_events(event_id),
  snapshot_json TEXT NOT NULL CHECK(json_valid(snapshot_json)),
  UNIQUE(plan_id,ordinal),
  UNIQUE(plan_id,coverage_page_id),
  CHECK(json_extract(snapshot_json,'$.id') IS id),
  CHECK(json_extract(snapshot_json,'$.planId') IS plan_id),
  CHECK(json_extract(snapshot_json,'$.ordinal') IS ordinal),
  CHECK(json_extract(snapshot_json,'$.coveragePageId') IS coverage_page_id),
  CHECK(json_extract(snapshot_json,'$.auditEventId') IS audit_event_id),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO system_record_retirement_receipts (id, plan_id, ordinal, digest, coverage_page_id, audit_event_id, snapshot_json)
SELECT map.new_id,
       source.plan_id,
       source.ordinal,
       source.digest,
       source.coverage_page_id,
       source.audit_event_id,
       source.snapshot_json
FROM "_stage_system_record_retirement_receipts" source
INNER JOIN _system_record_retirement_receipts_id_map map ON map.old_id = source.id;
INSERT INTO _system_infrastructure_uuid_primary_key_validation
SELECT 'system_record_retirement_receipts',
       (SELECT count(*) FROM "_stage_system_record_retirement_receipts"),
       (SELECT count(*) FROM system_record_retirement_receipts),
       0,
       (SELECT count(*) FROM system_record_retirement_receipts WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       0;
DROP TABLE "_stage_system_record_retirement_receipts";
CREATE TRIGGER system_record_retirement_receipts_insert BEFORE INSERT ON system_record_retirement_receipts
BEGIN
  SELECT RAISE(ABORT,'record_retirement_receipt_conflict') WHERE EXISTS (
    SELECT 1 FROM system_record_retirement_receipts WHERE id=NEW.id
      OR (plan_id=NEW.plan_id AND (ordinal>=NEW.ordinal OR coverage_page_id=NEW.coverage_page_id))
  );
  SELECT RAISE(ABORT,'record_retirement_receipt_plan_invalid') WHERE NOT EXISTS (
    SELECT 1 FROM system_record_retirement_plans plan
    JOIN system_record_source_freezes freeze ON freeze.id=plan.freeze_id AND freeze.revision=1
    JOIN json_each(plan.snapshot_json,'$.coverage') c
    JOIN system_record_coverage_pages page ON page.id=NEW.coverage_page_id
      AND page.freeze_id=plan.freeze_id AND page.record_kind IS json_extract(c.value,'$.recordKind')
    WHERE plan.id=NEW.plan_id AND plan.digest IS json_extract(NEW.snapshot_json,'$.planDigest')
      AND page.digest IS json_extract(NEW.snapshot_json,'$.coveragePageDigest')
      AND page.sequence <= json_extract(c.value,'$.pageCount')
      AND NEW.ordinal IS page.sequence + (SELECT coalesce(sum(json_extract(prior.value,'$.pageCount')),0)
        FROM json_each(plan.snapshot_json,'$.coverage') prior WHERE prior.key<c.key)
      AND julianday(json_extract(NEW.snapshot_json,'$.checkedAt')) >= julianday(json_extract(plan.snapshot_json,'$.createdAt'))
      AND julianday(json_extract(NEW.snapshot_json,'$.checkedAt')) >= julianday(json_extract(page.snapshot_json,'$.checkedAt'))
  );
  SELECT RAISE(ABORT,'record_retirement_receipt_order_invalid') WHERE
    (NEW.ordinal=1 AND json_type(NEW.snapshot_json,'$.previousReceiptDigest') IS NOT 'null')
    OR (NEW.ordinal>1 AND NOT EXISTS (
      SELECT 1 FROM system_record_retirement_receipts previous
      WHERE previous.plan_id=NEW.plan_id AND previous.ordinal=NEW.ordinal-1
        AND previous.digest IS json_extract(NEW.snapshot_json,'$.previousReceiptDigest')
        AND julianday(json_extract(NEW.snapshot_json,'$.checkedAt')) >= julianday(json_extract(previous.snapshot_json,'$.checkedAt'))
    ));
  SELECT RAISE(ABORT,'record_retirement_receipt_audit_missing') WHERE NOT EXISTS (
    SELECT 1 FROM system_audit_events a WHERE a.event_id=NEW.audit_event_id
      AND a.action='system.record.retirement.page.verified' AND a.target_type='system:record-retirement-receipt'
      AND a.target_id=NEW.id AND a.outcome='succeeded' AND a.before_json IS NULL
      AND a.actor_account_id IS json_extract(NEW.snapshot_json,'$.actorAccountId')
      AND a.after_json IS NEW.snapshot_json
      AND strftime('%Y-%m-%dT%H:%M:%fZ',a.occurred_at/1000.0,'unixepoch') IS json_extract(NEW.snapshot_json,'$.checkedAt')
  );
END;
CREATE TRIGGER system_record_retirement_receipts_update BEFORE UPDATE ON system_record_retirement_receipts
BEGIN
  SELECT RAISE(ABORT,'record_retirement_receipt_immutable');
END;
CREATE TRIGGER system_record_retirement_receipts_delete BEFORE DELETE ON system_record_retirement_receipts
BEGIN
  SELECT RAISE(ABORT,'record_retirement_receipt_immutable');
END;
CREATE TRIGGER system_record_retirement_receipts_pin_attachments AFTER INSERT ON system_record_retirement_receipts
BEGIN
  SELECT RAISE(ABORT,'record_retirement_attachment_format_unsupported') WHERE EXISTS (
    SELECT 1 FROM system_record_coverage_pages page, json_each(page.snapshot_json,'$.records') item
    WHERE page.id=NEW.coverage_page_id
      AND json_extract(item.value,'$.source.formatId')='system-attachment-record'
      AND json_extract(item.value,'$.source.formatVersion') IS NOT 1
  );
  INSERT INTO system_record_retirement_attachment_pins(receipt_id,attachment_id)
    SELECT NEW.id,json_extract(item.value,'$.source.recordId')
    FROM system_record_coverage_pages page, json_each(page.snapshot_json,'$.records') item
    WHERE page.id=NEW.coverage_page_id AND json_extract(item.value,'$.source.formatId')='system-attachment-record';
END;
CREATE TRIGGER system_record_retirement_receipts_storage_keys BEFORE INSERT ON system_record_retirement_receipts
BEGIN
  SELECT RAISE(ABORT,'record_retirement_storage_keys_invalid') WHERE
    json_type(NEW.snapshot_json,'$.storageKeys') IS NOT 'array'
    OR json_array_length(NEW.snapshot_json,'$.storageKeys')>200
    OR (SELECT count(DISTINCT json_extract(value,'$.version')) FROM json_each(NEW.snapshot_json,'$.storageKeys'))
      <>json_array_length(NEW.snapshot_json,'$.storageKeys')
    OR EXISTS (SELECT 1 FROM json_each(NEW.snapshot_json,'$.storageKeys') key
      WHERE json_type(key.value,'$.version') IS NOT 'integer' OR json_extract(key.value,'$.version')<=0
        OR length(json_extract(key.value,'$.digest')) IS NOT 64
        OR json_extract(key.value,'$.digest') GLOB '*[^0-9a-f]*');
  SELECT RAISE(ABORT,'record_retirement_storage_keys_incomplete') WHERE
    EXISTS (SELECT 1 FROM (SELECT attachment.kek_version AS version FROM system_record_coverage_pages page
      JOIN json_each(page.snapshot_json,'$.records') item
      JOIN system_preserved_records record ON record.id=json_extract(item.value,'$.preservedRecordId')
      JOIN system_attachments attachment ON attachment.id=record.attachment_id WHERE page.id=NEW.coverage_page_id
      UNION SELECT attachment.kek_version AS version FROM system_record_coverage_pages page
      JOIN json_each(page.snapshot_json,'$.records') item
      JOIN system_attachments attachment ON attachment.id=json_extract(item.value,'$.source.recordId')
      WHERE page.id=NEW.coverage_page_id AND json_extract(item.value,'$.source.formatId')='system-attachment-record' ) expected WHERE NOT EXISTS (
      SELECT 1 FROM json_each(NEW.snapshot_json,'$.storageKeys') key WHERE json_extract(key.value,'$.version') IS expected.version
    )) OR EXISTS (SELECT 1 FROM json_each(NEW.snapshot_json,'$.storageKeys') key WHERE NOT EXISTS (
      SELECT 1 FROM (SELECT attachment.kek_version AS version FROM system_record_coverage_pages page
      JOIN json_each(page.snapshot_json,'$.records') item
      JOIN system_preserved_records record ON record.id=json_extract(item.value,'$.preservedRecordId')
      JOIN system_attachments attachment ON attachment.id=record.attachment_id WHERE page.id=NEW.coverage_page_id
      UNION SELECT attachment.kek_version AS version FROM system_record_coverage_pages page
      JOIN json_each(page.snapshot_json,'$.records') item
      JOIN system_attachments attachment ON attachment.id=json_extract(item.value,'$.source.recordId')
      WHERE page.id=NEW.coverage_page_id AND json_extract(item.value,'$.source.formatId')='system-attachment-record' ) expected WHERE expected.version IS json_extract(key.value,'$.version')
    ));
END;

-- system_record_retirement_attachment_pins
CREATE TABLE system_record_retirement_attachment_pins (
  -- 撤去の trigger が行を足すため、主キーは列の既定値で採番する。
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  receipt_id TEXT NOT NULL REFERENCES system_record_retirement_receipts(id),
  attachment_id TEXT NOT NULL,
  UNIQUE(receipt_id,attachment_id),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO system_record_retirement_attachment_pins (id, receipt_id, attachment_id)
SELECT lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))),
       source.receipt_id,
       source.attachment_id
FROM "_stage_system_record_retirement_attachment_pins" source;
INSERT INTO _system_infrastructure_uuid_primary_key_validation
SELECT 'system_record_retirement_attachment_pins',
       (SELECT count(*) FROM "_stage_system_record_retirement_attachment_pins"),
       (SELECT count(*) FROM system_record_retirement_attachment_pins),
       0,
       (SELECT count(*) FROM system_record_retirement_attachment_pins WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       0;
DROP TABLE "_stage_system_record_retirement_attachment_pins";
CREATE INDEX system_record_retirement_attachment_pins_attachment_idx
  ON system_record_retirement_attachment_pins(attachment_id,receipt_id);
CREATE TRIGGER system_record_retirement_attachment_pins_insert BEFORE INSERT ON system_record_retirement_attachment_pins
BEGIN
  SELECT RAISE(ABORT,'record_retirement_attachment_pin_duplicate') WHERE EXISTS (
    SELECT 1 FROM system_record_retirement_attachment_pins WHERE receipt_id=NEW.receipt_id AND attachment_id=NEW.attachment_id
  );
  SELECT RAISE(ABORT,'record_retirement_attachment_pin_invalid') WHERE NOT EXISTS (
    SELECT 1 FROM system_record_retirement_receipts receipt
    JOIN system_record_retirement_plans plan ON plan.id=receipt.plan_id
    JOIN system_record_source_freezes freeze ON freeze.id=plan.freeze_id AND freeze.revision=1
    JOIN system_record_coverage_pages page ON page.id=receipt.coverage_page_id
    JOIN json_each(page.snapshot_json,'$.records') item
    JOIN system_attachments attachment ON attachment.id=NEW.attachment_id
    WHERE receipt.id=NEW.receipt_id
      AND json_extract(item.value,'$.source.recordId') IS NEW.attachment_id
      AND json_extract(item.value,'$.source.formatId')='system-attachment-record'
      AND json_extract(item.value,'$.source.formatVersion') IS 1
      AND attachment.status='linked' AND attachment.erased_at IS NULL
      AND attachment.wrapped_dek IS NOT NULL AND attachment.wrapped_dek_iv IS NOT NULL
      AND attachment.linked_at IS NOT NULL AND attachment.created_at<=attachment.linked_at
      AND attachment.linked_at<=round((julianday(json_extract(receipt.snapshot_json,'$.checkedAt'))-2440587.5)*86400000)
  );
END;
CREATE TRIGGER system_record_retirement_attachment_pins_update BEFORE UPDATE ON system_record_retirement_attachment_pins
BEGIN
  SELECT RAISE(ABORT,'record_retirement_attachment_pin_immutable');
END;
CREATE TRIGGER system_record_retirement_attachment_pins_delete BEFORE DELETE ON system_record_retirement_attachment_pins
BEGIN
  SELECT RAISE(ABORT,'record_retirement_attachment_pin_immutable');
END;
CREATE TRIGGER system_record_retirement_attachment_pins_identity_update
BEFORE UPDATE OF id ON system_record_retirement_attachment_pins
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- system_record_source_retirements
CREATE TABLE system_record_source_retirements (
  id TEXT PRIMARY KEY NOT NULL,
  freeze_id TEXT NOT NULL UNIQUE REFERENCES system_record_source_freezes(id),
  plan_id TEXT NOT NULL UNIQUE REFERENCES system_record_retirement_plans(id),
  terminal_receipt_id TEXT NOT NULL REFERENCES system_record_retirement_receipts(id),
  proposal_id TEXT NOT NULL UNIQUE REFERENCES system_proposals(id),
  case_id TEXT NOT NULL UNIQUE REFERENCES system_cases(id),
  execution_authorization_id TEXT NOT NULL UNIQUE REFERENCES system_execution_authorizations(id),
  audit_event_id TEXT NOT NULL UNIQUE REFERENCES system_audit_events(event_id),
  snapshot_json TEXT NOT NULL CHECK(json_valid(snapshot_json)),
  CHECK(json_extract(snapshot_json,'$.id') IS id),
  CHECK(json_extract(snapshot_json,'$.freezeId') IS freeze_id),
  CHECK(json_extract(snapshot_json,'$.planId') IS plan_id),
  CHECK(json_extract(snapshot_json,'$.terminalReceiptId') IS terminal_receipt_id),
  CHECK(json_extract(snapshot_json,'$.proposalId') IS proposal_id),
  CHECK(json_extract(snapshot_json,'$.caseId') IS case_id),
  CHECK(json_extract(snapshot_json,'$.executionAuthorizationId') IS execution_authorization_id),
  CHECK(json_extract(snapshot_json,'$.auditEventId') IS audit_event_id),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO system_record_source_retirements (id, freeze_id, plan_id, terminal_receipt_id, proposal_id, case_id, execution_authorization_id, audit_event_id, snapshot_json)
SELECT map.new_id,
       source.freeze_id,
       source.plan_id,
       source.terminal_receipt_id,
       source.proposal_id,
       source.case_id,
       source.execution_authorization_id,
       source.audit_event_id,
       source.snapshot_json
FROM "_stage_system_record_source_retirements" source
INNER JOIN _system_record_source_retirements_id_map map ON map.old_id = source.id;
INSERT INTO _system_infrastructure_uuid_primary_key_validation
SELECT 'system_record_source_retirements',
       (SELECT count(*) FROM "_stage_system_record_source_retirements"),
       (SELECT count(*) FROM system_record_source_retirements),
       0,
       (SELECT count(*) FROM system_record_source_retirements WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       0;
DROP TABLE "_stage_system_record_source_retirements";
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
CREATE TRIGGER system_record_source_retirements_update BEFORE UPDATE ON system_record_source_retirements
BEGIN
  SELECT RAISE(ABORT,'record_source_retirement_immutable');
END;
CREATE TRIGGER system_record_source_retirements_delete BEFORE DELETE ON system_record_source_retirements
BEGIN
  SELECT RAISE(ABORT,'record_source_retirement_immutable');
END;

-- system_connectors
CREATE TABLE system_connectors (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) BETWEEN 1 AND 255),
  key TEXT NOT NULL UNIQUE CHECK (length(key) BETWEEN 1 AND 63),
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 200 AND trim(name) = name),
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound', 'bidirectional')),
  transport TEXT NOT NULL CHECK (transport IN ('api', 'file', 'webhook')),
  status TEXT NOT NULL CHECK (status IN ('active', 'disabled')),
  revision INTEGER NOT NULL CHECK (revision >= 1),
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  updated_at INTEGER NOT NULL CHECK (updated_at >= created_at),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO system_connectors (id, key, name, direction, transport, status, revision, created_at, updated_at)
SELECT map.new_id,
       source.key,
       source.name,
       source.direction,
       source.transport,
       source.status,
       source.revision,
       source.created_at,
       source.updated_at
FROM "_stage_system_connectors" source
INNER JOIN _system_connectors_id_map map ON map.old_id = source.id;
INSERT INTO _system_infrastructure_uuid_primary_key_validation
SELECT 'system_connectors',
       (SELECT count(*) FROM "_stage_system_connectors"),
       (SELECT count(*) FROM system_connectors),
       0,
       (SELECT count(*) FROM system_connectors WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       0;
DROP TABLE "_stage_system_connectors";
CREATE INDEX system_connectors_status_idx ON system_connectors (status, key);
CREATE TRIGGER system_connectors_revision_step
BEFORE UPDATE ON system_connectors
WHEN NEW.revision <> OLD.revision + 1 OR NEW.updated_at < OLD.updated_at
BEGIN
  SELECT RAISE(ABORT, 'system_connector_revision_conflict');
END;

-- system_integration_exchanges
CREATE TABLE system_integration_exchanges (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) BETWEEN 1 AND 255),
  connector_id TEXT NOT NULL REFERENCES system_connectors(id) ON DELETE RESTRICT,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  operation_key TEXT NOT NULL CHECK (length(operation_key) BETWEEN 1 AND 200),
  idempotency_key TEXT NOT NULL CHECK (length(idempotency_key) BETWEEN 1 AND 255),
  payload_digest TEXT NOT NULL CHECK (length(payload_digest) = 64 AND payload_digest NOT GLOB '*[^0-9a-f]*'),
  status TEXT NOT NULL CHECK (status IN ('pending', 'succeeded', 'failed', 'cancelled')),
  attempt INTEGER NOT NULL CHECK (attempt BETWEEN 1 AND 100),
  external_reference TEXT CHECK (external_reference IS NULL OR length(external_reference) BETWEEN 1 AND 512),
  last_error_code TEXT CHECK (last_error_code IS NULL OR length(last_error_code) BETWEEN 1 AND 200),
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  updated_at INTEGER NOT NULL CHECK (updated_at >= created_at),
  completed_at INTEGER CHECK (completed_at IS NULL OR completed_at >= created_at),
  CHECK ((status = 'pending' AND completed_at IS NULL) OR (status <> 'pending' AND completed_at IS NOT NULL)),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO system_integration_exchanges (id, connector_id, direction, operation_key, idempotency_key, payload_digest, status, attempt, external_reference, last_error_code, created_at, updated_at, completed_at)
SELECT map.new_id,
       source.connector_id,
       source.direction,
       source.operation_key,
       source.idempotency_key,
       source.payload_digest,
       source.status,
       source.attempt,
       source.external_reference,
       source.last_error_code,
       source.created_at,
       source.updated_at,
       source.completed_at
FROM "_stage_system_integration_exchanges" source
INNER JOIN _system_integration_exchanges_id_map map ON map.old_id = source.id;
INSERT INTO _system_infrastructure_uuid_primary_key_validation
SELECT 'system_integration_exchanges',
       (SELECT count(*) FROM "_stage_system_integration_exchanges"),
       (SELECT count(*) FROM system_integration_exchanges),
       0,
       (SELECT count(*) FROM system_integration_exchanges WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       0;
DROP TABLE "_stage_system_integration_exchanges";
CREATE UNIQUE INDEX system_integration_exchanges_idempotency_uniq
  ON system_integration_exchanges (connector_id, idempotency_key);
CREATE INDEX system_integration_exchanges_status_idx
  ON system_integration_exchanges (connector_id, status, updated_at);

-- system_external_assertions
CREATE TABLE system_external_assertions (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) BETWEEN 1 AND 255),
  connector_id TEXT NOT NULL REFERENCES system_connectors(id) ON DELETE RESTRICT,
  exchange_id TEXT REFERENCES system_integration_exchanges(id) ON DELETE RESTRICT,
  external_key TEXT NOT NULL CHECK (length(external_key) BETWEEN 1 AND 512),
  external_version TEXT NOT NULL CHECK (length(external_version) BETWEEN 1 AND 255),
  payload_digest TEXT NOT NULL CHECK (length(payload_digest) = 64 AND payload_digest NOT GLOB '*[^0-9a-f]*'),
  observed_at INTEGER NOT NULL CHECK (observed_at >= 0),
  received_at INTEGER NOT NULL CHECK (received_at >= observed_at),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO system_external_assertions (id, connector_id, exchange_id, external_key, external_version, payload_digest, observed_at, received_at)
SELECT map.new_id,
       source.connector_id,
       source.exchange_id,
       source.external_key,
       source.external_version,
       source.payload_digest,
       source.observed_at,
       source.received_at
FROM "_stage_system_external_assertions" source
INNER JOIN _system_external_assertions_id_map map ON map.old_id = source.id;
INSERT INTO _system_infrastructure_uuid_primary_key_validation
SELECT 'system_external_assertions',
       (SELECT count(*) FROM "_stage_system_external_assertions"),
       (SELECT count(*) FROM system_external_assertions),
       0,
       (SELECT count(*) FROM system_external_assertions WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       0;
DROP TABLE "_stage_system_external_assertions";
CREATE UNIQUE INDEX system_external_assertions_version_uniq
  ON system_external_assertions (connector_id, external_key, external_version);
CREATE INDEX system_external_assertions_exchange_idx
  ON system_external_assertions (exchange_id, received_at);
CREATE TRIGGER system_external_assertions_no_update
BEFORE UPDATE ON system_external_assertions
BEGIN
  SELECT RAISE(ABORT, 'system_external_assertions_are_immutable');
END;
CREATE TRIGGER system_external_assertions_no_delete
BEFORE DELETE ON system_external_assertions
BEGIN
  SELECT RAISE(ABORT, 'system_external_assertions_are_immutable');
END;

-- system_reconciliation_runs
CREATE TABLE system_reconciliation_runs (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) BETWEEN 1 AND 255),
  exchange_id TEXT NOT NULL REFERENCES system_integration_exchanges(id) ON DELETE RESTRICT,
  assertion_id TEXT NOT NULL REFERENCES system_external_assertions(id) ON DELETE RESTRICT,
  local_version TEXT NOT NULL CHECK (length(local_version) BETWEEN 1 AND 255),
  status TEXT NOT NULL CHECK (status IN ('matched', 'mismatched')),
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO system_reconciliation_runs (id, exchange_id, assertion_id, local_version, status, created_at)
SELECT map.new_id,
       source.exchange_id,
       source.assertion_id,
       source.local_version,
       source.status,
       source.created_at
FROM "_stage_system_reconciliation_runs" source
INNER JOIN _system_reconciliation_runs_id_map map ON map.old_id = source.id;
INSERT INTO _system_infrastructure_uuid_primary_key_validation
SELECT 'system_reconciliation_runs',
       (SELECT count(*) FROM "_stage_system_reconciliation_runs"),
       (SELECT count(*) FROM system_reconciliation_runs),
       0,
       (SELECT count(*) FROM system_reconciliation_runs WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       0;
DROP TABLE "_stage_system_reconciliation_runs";
CREATE UNIQUE INDEX system_reconciliation_runs_input_uniq
  ON system_reconciliation_runs (exchange_id, assertion_id, local_version);
CREATE INDEX system_reconciliation_runs_status_idx
  ON system_reconciliation_runs (status, created_at);
CREATE TRIGGER system_reconciliation_runs_no_update
BEFORE UPDATE ON system_reconciliation_runs
BEGIN
  SELECT RAISE(ABORT, 'system_reconciliation_runs_are_immutable');
END;
CREATE TRIGGER system_reconciliation_runs_no_delete
BEFORE DELETE ON system_reconciliation_runs
BEGIN
  SELECT RAISE(ABORT, 'system_reconciliation_runs_are_immutable');
END;

-- system_reconciliation_items
CREATE TABLE system_reconciliation_items (
  id TEXT PRIMARY KEY NOT NULL,
  run_id TEXT NOT NULL REFERENCES system_reconciliation_runs(id) ON DELETE RESTRICT,
  item_key TEXT NOT NULL CHECK (length(item_key) BETWEEN 1 AND 512),
  local_digest TEXT CHECK (local_digest IS NULL OR (length(local_digest) = 64 AND local_digest NOT GLOB '*[^0-9a-f]*')),
  external_digest TEXT CHECK (external_digest IS NULL OR (length(external_digest) = 64 AND external_digest NOT GLOB '*[^0-9a-f]*')),
  status TEXT NOT NULL CHECK (status IN ('matched', 'different', 'missing_local', 'missing_external')),
  UNIQUE (run_id, item_key),
  CHECK (
    (status = 'matched' AND local_digest = external_digest AND local_digest IS NOT NULL)
    OR (status = 'different' AND local_digest <> external_digest AND local_digest IS NOT NULL AND external_digest IS NOT NULL)
    OR (status = 'missing_local' AND local_digest IS NULL AND external_digest IS NOT NULL)
    OR (status = 'missing_external' AND local_digest IS NOT NULL AND external_digest IS NULL)
  ),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO system_reconciliation_items (id, run_id, item_key, local_digest, external_digest, status)
SELECT lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))),
       source.run_id,
       source.item_key,
       source.local_digest,
       source.external_digest,
       source.status
FROM "_stage_system_reconciliation_items" source;
INSERT INTO _system_infrastructure_uuid_primary_key_validation
SELECT 'system_reconciliation_items',
       (SELECT count(*) FROM "_stage_system_reconciliation_items"),
       (SELECT count(*) FROM system_reconciliation_items),
       0,
       (SELECT count(*) FROM system_reconciliation_items WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       0;
DROP TABLE "_stage_system_reconciliation_items";
CREATE TRIGGER system_reconciliation_items_no_update
BEFORE UPDATE ON system_reconciliation_items
BEGIN
  SELECT RAISE(ABORT, 'system_reconciliation_items_are_immutable');
END;
CREATE TRIGGER system_reconciliation_items_no_delete
BEFORE DELETE ON system_reconciliation_items
BEGIN
  SELECT RAISE(ABORT, 'system_reconciliation_items_are_immutable');
END;
CREATE TRIGGER system_reconciliation_items_identity_update
BEFORE UPDATE OF id ON system_reconciliation_items
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- system_jobs
CREATE TABLE system_jobs (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) BETWEEN 1 AND 255),
  operation_key TEXT NOT NULL CHECK (operation_key GLOB '[a-z]*' AND length(operation_key) <= 200),
  payload_digest TEXT NOT NULL CHECK (length(payload_digest) = 64 AND payload_digest NOT GLOB '*[^0-9a-f]*'),
  idempotency_key TEXT NOT NULL CHECK (length(idempotency_key) BETWEEN 1 AND 255),
  created_by_account_id TEXT NOT NULL REFERENCES system_accounts(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN ('queued', 'leased', 'succeeded', 'dead_letter')),
  attempt INTEGER NOT NULL CHECK (attempt BETWEEN 0 AND max_attempts),
  max_attempts INTEGER NOT NULL CHECK (max_attempts BETWEEN 1 AND 100),
  available_at INTEGER NOT NULL CHECK (available_at >= created_at),
  lease_account_id TEXT REFERENCES system_accounts(id) ON DELETE RESTRICT,
  lease_token_hash TEXT CHECK (lease_token_hash IS NULL OR (length(lease_token_hash) = 64 AND lease_token_hash NOT GLOB '*[^0-9a-f]*')),
  lease_expires_at INTEGER,
  last_error_code TEXT CHECK (last_error_code IS NULL OR length(last_error_code) BETWEEN 1 AND 200),
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  updated_at INTEGER NOT NULL CHECK (updated_at >= created_at),
  completed_at INTEGER, handler_key TEXT CHECK (handler_key IS NULL OR length(handler_key) BETWEEN 1 AND 200),
  CHECK (
    (status = 'leased' AND lease_account_id IS NOT NULL AND lease_token_hash IS NOT NULL
      AND lease_expires_at > updated_at AND completed_at IS NULL)
    OR (status = 'queued' AND lease_account_id IS NULL AND lease_token_hash IS NULL
      AND lease_expires_at IS NULL AND completed_at IS NULL)
    OR (status = 'succeeded' AND lease_account_id IS NULL AND lease_token_hash IS NULL
      AND lease_expires_at IS NULL AND completed_at = updated_at AND last_error_code IS NULL)
    OR (status = 'dead_letter' AND attempt = max_attempts
      AND lease_account_id IS NULL AND lease_token_hash IS NULL
      AND lease_expires_at IS NULL AND completed_at = updated_at AND last_error_code IS NOT NULL)
  ),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO system_jobs (id, operation_key, payload_digest, idempotency_key, created_by_account_id, status, attempt, max_attempts, available_at, lease_account_id, lease_token_hash, lease_expires_at, last_error_code, created_at, updated_at, completed_at, handler_key)
SELECT map.new_id,
       source.operation_key,
       source.payload_digest,
       source.idempotency_key,
       source.created_by_account_id,
       source.status,
       source.attempt,
       source.max_attempts,
       source.available_at,
       source.lease_account_id,
       source.lease_token_hash,
       source.lease_expires_at,
       source.last_error_code,
       source.created_at,
       source.updated_at,
       source.completed_at,
       source.handler_key
FROM "_stage_system_jobs" source
INNER JOIN _system_jobs_id_map map ON map.old_id = source.id;
INSERT INTO _system_infrastructure_uuid_primary_key_validation
SELECT 'system_jobs',
       (SELECT count(*) FROM "_stage_system_jobs"),
       (SELECT count(*) FROM system_jobs),
       0,
       (SELECT count(*) FROM system_jobs WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       0;
DROP TABLE "_stage_system_jobs";
CREATE UNIQUE INDEX system_jobs_idempotency_uniq ON system_jobs (operation_key, idempotency_key);
CREATE INDEX system_jobs_claim_idx ON system_jobs (status, available_at, id);
CREATE INDEX system_jobs_lease_idx ON system_jobs (status, lease_expires_at);
CREATE INDEX system_jobs_handler_claim_idx ON system_jobs(handler_key, status, available_at, id);
CREATE TRIGGER system_jobs_monotonic_update
BEFORE UPDATE ON system_jobs
WHEN NEW.id <> OLD.id OR NEW.operation_key <> OLD.operation_key
  OR NEW.payload_digest <> OLD.payload_digest OR NEW.idempotency_key <> OLD.idempotency_key
  OR NEW.created_by_account_id <> OLD.created_by_account_id OR NEW.created_at <> OLD.created_at
  OR NEW.max_attempts <> OLD.max_attempts OR NEW.attempt < OLD.attempt OR NEW.attempt > OLD.attempt + 1
  OR NEW.updated_at < OLD.updated_at OR OLD.status IN ('succeeded', 'dead_letter')
  OR (OLD.status = 'queued' AND NEW.status NOT IN ('queued', 'leased'))
BEGIN
  SELECT RAISE(ABORT, 'system_job_update_invalid');
END;
CREATE TRIGGER system_jobs_no_delete BEFORE DELETE ON system_jobs
BEGIN SELECT RAISE(ABORT, 'system_jobs_are_retained'); END;
CREATE TRIGGER system_jobs_handler_immutable
BEFORE UPDATE ON system_jobs
WHEN NEW.handler_key IS NOT OLD.handler_key
BEGIN
  SELECT RAISE(ABORT, 'system_delivery_handler_immutable');
END;

-- system_outbox_messages
CREATE TABLE system_outbox_messages (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) BETWEEN 1 AND 255),
  topic TEXT NOT NULL CHECK (length(topic) BETWEEN 1 AND 200),
  source_context TEXT NOT NULL CHECK (length(source_context) BETWEEN 1 AND 100),
  source_kind TEXT NOT NULL CHECK (length(source_kind) BETWEEN 1 AND 100),
  source_id TEXT NOT NULL CHECK (length(source_id) BETWEEN 1 AND 255),
  source_version TEXT NOT NULL CHECK (length(source_version) BETWEEN 1 AND 255),
  payload_digest TEXT NOT NULL CHECK (length(payload_digest) = 64 AND payload_digest NOT GLOB '*[^0-9a-f]*'),
  idempotency_key TEXT NOT NULL CHECK (length(idempotency_key) BETWEEN 1 AND 255),
  created_by_account_id TEXT NOT NULL REFERENCES system_accounts(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN ('queued', 'leased', 'succeeded', 'dead_letter')),
  attempt INTEGER NOT NULL CHECK (attempt BETWEEN 0 AND max_attempts),
  max_attempts INTEGER NOT NULL CHECK (max_attempts BETWEEN 1 AND 100),
  available_at INTEGER NOT NULL CHECK (available_at >= created_at),
  lease_account_id TEXT REFERENCES system_accounts(id) ON DELETE RESTRICT,
  lease_token_hash TEXT CHECK (lease_token_hash IS NULL OR (length(lease_token_hash) = 64 AND lease_token_hash NOT GLOB '*[^0-9a-f]*')),
  lease_expires_at INTEGER,
  last_error_code TEXT CHECK (last_error_code IS NULL OR length(last_error_code) BETWEEN 1 AND 200),
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  updated_at INTEGER NOT NULL CHECK (updated_at >= created_at),
  completed_at INTEGER, handler_key TEXT CHECK (handler_key IS NULL OR length(handler_key) BETWEEN 1 AND 200),
  CHECK (
    (status = 'leased' AND lease_account_id IS NOT NULL AND lease_token_hash IS NOT NULL
      AND lease_expires_at > updated_at AND completed_at IS NULL)
    OR (status = 'queued' AND lease_account_id IS NULL AND lease_token_hash IS NULL
      AND lease_expires_at IS NULL AND completed_at IS NULL)
    OR (status = 'succeeded' AND lease_account_id IS NULL AND lease_token_hash IS NULL
      AND lease_expires_at IS NULL AND completed_at = updated_at AND last_error_code IS NULL)
    OR (status = 'dead_letter' AND attempt = max_attempts
      AND lease_account_id IS NULL AND lease_token_hash IS NULL
      AND lease_expires_at IS NULL AND completed_at = updated_at AND last_error_code IS NOT NULL)
  ),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO system_outbox_messages (id, topic, source_context, source_kind, source_id, source_version, payload_digest, idempotency_key, created_by_account_id, status, attempt, max_attempts, available_at, lease_account_id, lease_token_hash, lease_expires_at, last_error_code, created_at, updated_at, completed_at, handler_key)
SELECT map.new_id,
       source.topic,
       source.source_context,
       source.source_kind,
       source.source_id,
       source.source_version,
       source.payload_digest,
       source.idempotency_key,
       source.created_by_account_id,
       source.status,
       source.attempt,
       source.max_attempts,
       source.available_at,
       source.lease_account_id,
       source.lease_token_hash,
       source.lease_expires_at,
       source.last_error_code,
       source.created_at,
       source.updated_at,
       source.completed_at,
       source.handler_key
FROM "_stage_system_outbox_messages" source
INNER JOIN _system_outbox_messages_id_map map ON map.old_id = source.id;
INSERT INTO _system_infrastructure_uuid_primary_key_validation
SELECT 'system_outbox_messages',
       (SELECT count(*) FROM "_stage_system_outbox_messages"),
       (SELECT count(*) FROM system_outbox_messages),
       0,
       (SELECT count(*) FROM system_outbox_messages WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       0;
DROP TABLE "_stage_system_outbox_messages";
CREATE UNIQUE INDEX system_outbox_messages_idempotency_uniq
  ON system_outbox_messages (topic, idempotency_key);
CREATE INDEX system_outbox_messages_claim_idx ON system_outbox_messages (status, available_at, id);
CREATE INDEX system_outbox_messages_lease_idx ON system_outbox_messages (status, lease_expires_at);
CREATE INDEX system_outbox_handler_claim_idx ON system_outbox_messages(handler_key, status, available_at, id);
CREATE TRIGGER system_outbox_messages_monotonic_update
BEFORE UPDATE ON system_outbox_messages
WHEN NEW.id <> OLD.id OR NEW.topic <> OLD.topic OR NEW.source_context <> OLD.source_context
  OR NEW.source_kind <> OLD.source_kind OR NEW.source_id <> OLD.source_id
  OR NEW.source_version <> OLD.source_version OR NEW.payload_digest <> OLD.payload_digest
  OR NEW.idempotency_key <> OLD.idempotency_key
  OR NEW.created_by_account_id <> OLD.created_by_account_id OR NEW.created_at <> OLD.created_at
  OR NEW.max_attempts <> OLD.max_attempts OR NEW.attempt < OLD.attempt OR NEW.attempt > OLD.attempt + 1
  OR NEW.updated_at < OLD.updated_at OR OLD.status IN ('succeeded', 'dead_letter')
  OR (OLD.status = 'queued' AND NEW.status NOT IN ('queued', 'leased'))
BEGIN
  SELECT RAISE(ABORT, 'system_outbox_update_invalid');
END;
CREATE TRIGGER system_outbox_messages_no_delete BEFORE DELETE ON system_outbox_messages
BEGIN SELECT RAISE(ABORT, 'system_outbox_messages_are_retained'); END;
CREATE TRIGGER system_outbox_handler_immutable
BEFORE UPDATE ON system_outbox_messages
WHEN NEW.handler_key IS NOT OLD.handler_key
BEGIN
  SELECT RAISE(ABORT, 'system_delivery_handler_immutable');
END;

-- system_inbox_messages
CREATE TABLE system_inbox_messages (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) BETWEEN 1 AND 255),
  source_key TEXT NOT NULL CHECK (length(source_key) BETWEEN 1 AND 200),
  external_message_id TEXT NOT NULL CHECK (length(external_message_id) BETWEEN 1 AND 512),
  payload_digest TEXT NOT NULL CHECK (length(payload_digest) = 64 AND payload_digest NOT GLOB '*[^0-9a-f]*'),
  status TEXT NOT NULL CHECK (status IN ('accepted', 'processed', 'rejected')),
  received_at INTEGER NOT NULL CHECK (received_at >= 0),
  processed_at INTEGER,
  reason_code TEXT CHECK (reason_code IS NULL OR length(reason_code) BETWEEN 1 AND 200),
  CHECK (
    (status = 'accepted' AND processed_at IS NULL AND reason_code IS NULL)
    OR (status = 'processed' AND processed_at >= received_at AND reason_code IS NULL)
    OR (status = 'rejected' AND processed_at >= received_at AND reason_code IS NOT NULL)
  ),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO system_inbox_messages (id, source_key, external_message_id, payload_digest, status, received_at, processed_at, reason_code)
SELECT map.new_id,
       source.source_key,
       source.external_message_id,
       source.payload_digest,
       source.status,
       source.received_at,
       source.processed_at,
       source.reason_code
FROM "_stage_system_inbox_messages" source
INNER JOIN _system_inbox_messages_id_map map ON map.old_id = source.id;
INSERT INTO _system_infrastructure_uuid_primary_key_validation
SELECT 'system_inbox_messages',
       (SELECT count(*) FROM "_stage_system_inbox_messages"),
       (SELECT count(*) FROM system_inbox_messages),
       0,
       (SELECT count(*) FROM system_inbox_messages WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       0;
DROP TABLE "_stage_system_inbox_messages";
CREATE UNIQUE INDEX system_inbox_messages_external_uniq
  ON system_inbox_messages (source_key, external_message_id);
CREATE INDEX system_inbox_messages_status_idx ON system_inbox_messages (status, received_at);
CREATE TRIGGER system_inbox_messages_monotonic_update
BEFORE UPDATE ON system_inbox_messages
WHEN NEW.id <> OLD.id OR NEW.source_key <> OLD.source_key
  OR NEW.external_message_id <> OLD.external_message_id OR NEW.payload_digest <> OLD.payload_digest
  OR NEW.received_at <> OLD.received_at OR OLD.status <> 'accepted'
  OR NEW.status = 'accepted'
BEGIN
  SELECT RAISE(ABORT, 'system_inbox_update_invalid');
END;
CREATE TRIGGER system_inbox_messages_no_delete BEFORE DELETE ON system_inbox_messages
BEGIN SELECT RAISE(ABORT, 'system_inbox_messages_are_retained'); END;

-- system_dead_letters
CREATE TABLE system_dead_letters (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) BETWEEN 1 AND 255),
  source_type TEXT NOT NULL CHECK (source_type IN ('job', 'outbox', 'inbox')),
  source_id TEXT NOT NULL CHECK (length(source_id) BETWEEN 1 AND 255),
  payload_digest TEXT NOT NULL CHECK (length(payload_digest) = 64 AND payload_digest NOT GLOB '*[^0-9a-f]*'),
  reason_code TEXT NOT NULL CHECK (length(reason_code) BETWEEN 1 AND 200),
  attempt INTEGER NOT NULL CHECK (attempt BETWEEN 0 AND 100),
  recorded_at INTEGER NOT NULL CHECK (recorded_at >= 0),
  requeued_job_id TEXT REFERENCES system_jobs(id) ON DELETE RESTRICT,
  requeued_at INTEGER,
  CHECK ((requeued_job_id IS NULL) = (requeued_at IS NULL)),
  CHECK (requeued_at IS NULL OR requeued_at >= recorded_at),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO system_dead_letters (id, source_type, source_id, payload_digest, reason_code, attempt, recorded_at, requeued_job_id, requeued_at)
SELECT map.new_id,
       source.source_type,
       source.source_id,
       source.payload_digest,
       source.reason_code,
       source.attempt,
       source.recorded_at,
       source.requeued_job_id,
       source.requeued_at
FROM "_stage_system_dead_letters" source
INNER JOIN _system_dead_letters_id_map map ON map.old_id = source.id;
INSERT INTO _system_infrastructure_uuid_primary_key_validation
SELECT 'system_dead_letters',
       (SELECT count(*) FROM "_stage_system_dead_letters"),
       (SELECT count(*) FROM system_dead_letters),
       0,
       (SELECT count(*) FROM system_dead_letters WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       0;
DROP TABLE "_stage_system_dead_letters";
CREATE UNIQUE INDEX system_dead_letters_source_uniq ON system_dead_letters (source_type, source_id);
CREATE INDEX system_dead_letters_recorded_idx ON system_dead_letters (recorded_at, id);
CREATE TRIGGER system_dead_letters_source_guard
BEFORE INSERT ON system_dead_letters
WHEN (NEW.source_type = 'job' AND NOT EXISTS (
    SELECT 1 FROM system_jobs WHERE id = NEW.source_id AND status = 'dead_letter'
  )) OR (NEW.source_type = 'outbox' AND NOT EXISTS (
    SELECT 1 FROM system_outbox_messages WHERE id = NEW.source_id AND status = 'dead_letter'
  )) OR (NEW.source_type = 'inbox' AND NOT EXISTS (
    SELECT 1 FROM system_inbox_messages WHERE id = NEW.source_id AND status = 'rejected'
  ))
BEGIN
  SELECT RAISE(ABORT, 'system_dead_letter_source_invalid');
END;
CREATE TRIGGER system_dead_letters_monotonic_update
BEFORE UPDATE ON system_dead_letters
WHEN NEW.id <> OLD.id OR NEW.source_type <> OLD.source_type OR NEW.source_id <> OLD.source_id
  OR NEW.payload_digest <> OLD.payload_digest OR NEW.reason_code <> OLD.reason_code
  OR NEW.attempt <> OLD.attempt OR NEW.recorded_at <> OLD.recorded_at
  OR OLD.requeued_at IS NOT NULL OR NEW.requeued_at IS NULL OR NEW.requeued_job_id IS NULL
BEGIN
  SELECT RAISE(ABORT, 'system_dead_letter_update_invalid');
END;
CREATE TRIGGER system_dead_letters_no_delete BEFORE DELETE ON system_dead_letters
BEGIN SELECT RAISE(ABORT, 'system_dead_letters_are_retained'); END;

-- system_notification_messages
CREATE TABLE system_notification_messages (
  id TEXT PRIMARY KEY NOT NULL
    CHECK (length(id) BETWEEN 1 AND 255),
  kind TEXT NOT NULL
    CHECK (length(kind) BETWEEN 3 AND 100),
  title TEXT NOT NULL
    CHECK (length(title) BETWEEN 1 AND 200),
  body TEXT
    CHECK (body IS NULL OR length(body) BETWEEN 1 AND 10000),
  source_type TEXT,
  source_id TEXT,
  created_at INTEGER NOT NULL, action_url TEXT
  CHECK (action_url IS NULL OR length(action_url) BETWEEN 1 AND 2048), priority TEXT NOT NULL DEFAULT 'normal'
  CHECK (priority IN ('low', 'normal', 'high', 'critical')), dedupe_key TEXT, action_type TEXT
  CHECK (action_type IS NULL OR length(action_type) BETWEEN 3 AND 100), action_id TEXT
  CHECK (action_id IS NULL OR length(action_id) BETWEEN 1 AND 512),
  CHECK (
    (source_type IS NULL AND source_id IS NULL) OR (
      source_type IS NOT NULL AND source_id IS NOT NULL
      AND length(source_type) BETWEEN 3 AND 100
      AND length(source_id) BETWEEN 1 AND 512
    )
  ),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO system_notification_messages (id, kind, title, body, source_type, source_id, created_at, action_url, priority, dedupe_key, action_type, action_id)
SELECT map.new_id,
       source.kind,
       source.title,
       source.body,
       source.source_type,
       source.source_id,
       source.created_at,
       source.action_url,
       source.priority,
       source.dedupe_key,
       source.action_type,
       source.action_id
FROM "_stage_system_notification_messages" source
INNER JOIN _system_notification_messages_id_map map ON map.old_id = source.id;
INSERT INTO _system_infrastructure_uuid_primary_key_validation
SELECT 'system_notification_messages',
       (SELECT count(*) FROM "_stage_system_notification_messages"),
       (SELECT count(*) FROM system_notification_messages),
       0,
       (SELECT count(*) FROM system_notification_messages WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       0;
DROP TABLE "_stage_system_notification_messages";
CREATE INDEX system_notification_messages_source_idx
  ON system_notification_messages (source_type, source_id);
CREATE INDEX system_notification_messages_priority_idx
  ON system_notification_messages(priority, created_at);
CREATE UNIQUE INDEX system_notification_messages_dedupe_key_uniq
  ON system_notification_messages(dedupe_key);
CREATE TRIGGER system_notification_messages_prevent_update
BEFORE UPDATE ON system_notification_messages
BEGIN
  SELECT RAISE(ABORT, 'notification message is immutable');
END;
CREATE TRIGGER system_notification_messages_prevent_delete
BEFORE DELETE ON system_notification_messages
BEGIN
  SELECT RAISE(ABORT, 'notification message is immutable');
END;
CREATE TRIGGER system_notification_messages_action_pair_guard
BEFORE INSERT ON system_notification_messages
WHEN (NEW.action_type IS NULL) != (NEW.action_id IS NULL)
BEGIN
  SELECT RAISE(ABORT, 'notification action reference is incomplete');
END;

-- system_notification_deliveries
CREATE TABLE system_notification_deliveries (
  id TEXT PRIMARY KEY NOT NULL
    CHECK (length(id) BETWEEN 1 AND 255),
  message_id TEXT NOT NULL
    REFERENCES system_notification_messages(id) ON DELETE RESTRICT,
  recipient_account_id TEXT NOT NULL
    REFERENCES system_accounts(id) ON DELETE RESTRICT,
  delivered_at INTEGER NOT NULL,
  read_at INTEGER
    CHECK (read_at IS NULL OR read_at >= delivered_at)
, dismissed_at INTEGER
  CHECK (dismissed_at IS NULL OR dismissed_at >= delivered_at),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO system_notification_deliveries (id, message_id, recipient_account_id, delivered_at, read_at, dismissed_at)
SELECT map.new_id,
       source.message_id,
       source.recipient_account_id,
       source.delivered_at,
       source.read_at,
       source.dismissed_at
FROM "_stage_system_notification_deliveries" source
INNER JOIN _system_notification_deliveries_id_map map ON map.old_id = source.id;
INSERT INTO _system_infrastructure_uuid_primary_key_validation
SELECT 'system_notification_deliveries',
       (SELECT count(*) FROM "_stage_system_notification_deliveries"),
       (SELECT count(*) FROM system_notification_deliveries),
       0,
       (SELECT count(*) FROM system_notification_deliveries WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       0;
DROP TABLE "_stage_system_notification_deliveries";
CREATE UNIQUE INDEX system_notification_deliveries_message_account_uniq
  ON system_notification_deliveries (message_id, recipient_account_id);
CREATE INDEX system_notification_deliveries_account_idx
  ON system_notification_deliveries (recipient_account_id, delivered_at);
CREATE INDEX system_notification_deliveries_unread_idx
  ON system_notification_deliveries (recipient_account_id, delivered_at)
  WHERE read_at IS NULL AND dismissed_at IS NULL;
CREATE TRIGGER system_notification_deliveries_monotonic_read
BEFORE UPDATE ON system_notification_deliveries
WHEN
  NEW.id IS NOT OLD.id
  OR NEW.message_id IS NOT OLD.message_id
  OR NEW.recipient_account_id IS NOT OLD.recipient_account_id
  OR NEW.delivered_at IS NOT OLD.delivered_at
  OR (OLD.read_at IS NOT NULL AND NEW.read_at IS NOT OLD.read_at)
  OR (OLD.dismissed_at IS NOT NULL AND NEW.dismissed_at IS NOT OLD.dismissed_at)
  OR (OLD.dismissed_at IS NOT NULL AND NEW.read_at IS NOT OLD.read_at)
BEGIN
  SELECT RAISE(ABORT, 'notification delivery is immutable except first read and dismiss');
END;

-- system_notification_resource_scopes
CREATE TABLE system_notification_resource_scopes (
  message_id TEXT PRIMARY KEY NOT NULL
    REFERENCES system_notification_messages(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL
    CHECK (length(resource_type) BETWEEN 3 AND 100),
  resource_id TEXT NOT NULL
    CHECK (length(resource_id) BETWEEN 1 AND 512),
  CHECK (length(message_id) = 36 AND message_id NOT GLOB '*[^0-9a-f-]*' AND substr(message_id, 9, 1) = '-' AND substr(message_id, 14, 1) = '-' AND substr(message_id, 19, 1) = '-' AND substr(message_id, 24, 1) = '-' AND length(replace(message_id, '-', '')) = 32 AND substr(message_id, 15, 1) GLOB '[1-8]' AND substr(message_id, 20, 1) GLOB '[89ab]')
);
INSERT INTO system_notification_resource_scopes (message_id, resource_type, resource_id)
SELECT source.message_id,
       source.resource_type,
       source.resource_id
FROM "_stage_system_notification_resource_scopes" source;
INSERT INTO _system_infrastructure_uuid_primary_key_validation
SELECT 'system_notification_resource_scopes',
       (SELECT count(*) FROM "_stage_system_notification_resource_scopes"),
       (SELECT count(*) FROM system_notification_resource_scopes),
       0,
       (SELECT count(*) FROM system_notification_resource_scopes WHERE NOT (length(message_id) = 36 AND message_id NOT GLOB '*[^0-9a-f-]*' AND substr(message_id, 9, 1) = '-' AND substr(message_id, 14, 1) = '-' AND substr(message_id, 19, 1) = '-' AND substr(message_id, 24, 1) = '-' AND length(replace(message_id, '-', '')) = 32 AND substr(message_id, 15, 1) GLOB '[1-8]' AND substr(message_id, 20, 1) GLOB '[89ab]')),
       0;
DROP TABLE "_stage_system_notification_resource_scopes";
CREATE INDEX system_notification_resource_scopes_resource_idx
  ON system_notification_resource_scopes (resource_type, resource_id, message_id);

-- system_work_items
CREATE TABLE system_work_items (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 300),
  instructions TEXT NOT NULL CHECK (length(trim(instructions)) BETWEEN 1 AND 10000),
  acceptance_criteria TEXT NOT NULL CHECK (length(trim(acceptance_criteria)) BETWEEN 1 AND 10000),
  created_by_account_id TEXT NOT NULL REFERENCES system_accounts(id) ON DELETE RESTRICT,
  created_by_principal_id TEXT NOT NULL REFERENCES system_principals(id) ON DELETE RESTRICT,
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  due_at INTEGER CHECK (due_at IS NULL OR due_at >= created_at),
  previous_revision_id TEXT REFERENCES system_work_item_revisions(command_id) ON DELETE RESTRICT,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
-- 作業項目と版は互いを参照するため、両方の table を作ってから行を戻す。
CREATE TABLE system_work_item_revisions (
  id TEXT PRIMARY KEY NOT NULL,
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
  UNIQUE (work_item_id, revision),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO system_work_items (id, title, instructions, acceptance_criteria, created_by_account_id, created_by_principal_id, created_at, due_at, previous_revision_id)
SELECT map.new_id,
       source.title,
       source.instructions,
       source.acceptance_criteria,
       source.created_by_account_id,
       source.created_by_principal_id,
       source.created_at,
       source.due_at,
       source.previous_revision_id
FROM "_stage_system_work_items" source
INNER JOIN _system_work_items_id_map map ON map.old_id = source.id;
INSERT INTO _system_infrastructure_uuid_primary_key_validation
SELECT 'system_work_items',
       (SELECT count(*) FROM "_stage_system_work_items"),
       (SELECT count(*) FROM system_work_items),
       0,
       (SELECT count(*) FROM system_work_items WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       0;
DROP TABLE "_stage_system_work_items";
CREATE TRIGGER system_work_items_update BEFORE UPDATE ON system_work_items
BEGIN
  SELECT RAISE(ABORT, 'work item records are immutable');
END;
CREATE TRIGGER system_work_items_delete BEFORE DELETE ON system_work_items
BEGIN
  SELECT RAISE(ABORT, 'work item records are immutable');
END;

-- system_work_item_revisions
INSERT INTO system_work_item_revisions (id, work_item_id, revision, command_id, action, state, actor_account_id, actor_principal_id, accountable_account_id, accountable_principal_id, assignee_account_id, assignee_principal_id, recorded_at, snapshot_json, audit_event_id)
SELECT lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))),
       source.work_item_id,
       source.revision,
       source.command_id,
       source.action,
       source.state,
       source.actor_account_id,
       source.actor_principal_id,
       source.accountable_account_id,
       source.accountable_principal_id,
       source.assignee_account_id,
       source.assignee_principal_id,
       source.recorded_at,
       source.snapshot_json,
       source.audit_event_id
FROM "_stage_system_work_item_revisions" source;
INSERT INTO _system_infrastructure_uuid_primary_key_validation
SELECT 'system_work_item_revisions',
       (SELECT count(*) FROM "_stage_system_work_item_revisions"),
       (SELECT count(*) FROM system_work_item_revisions),
       0,
       (SELECT count(*) FROM system_work_item_revisions WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       0;
DROP TABLE "_stage_system_work_item_revisions";
CREATE INDEX system_work_items_accountable_idx ON system_work_item_revisions(accountable_account_id, work_item_id, revision);
CREATE INDEX system_work_items_assignee_idx ON system_work_item_revisions(assignee_account_id, work_item_id, revision);
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
CREATE TRIGGER system_work_item_revisions_update BEFORE UPDATE ON system_work_item_revisions
BEGIN
  SELECT RAISE(ABORT, 'work item records are immutable');
END;
CREATE TRIGGER system_work_item_revisions_delete BEFORE DELETE ON system_work_item_revisions
BEGIN
  SELECT RAISE(ABORT, 'work item records are immutable');
END;
CREATE TRIGGER system_work_item_revisions_identity_update
BEFORE UPDATE OF id ON system_work_item_revisions
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- system_work_evidence
CREATE TABLE system_work_evidence (
  attachment_id TEXT PRIMARY KEY NOT NULL REFERENCES system_attachments(id) ON DELETE RESTRICT,
  work_item_id TEXT NOT NULL REFERENCES system_work_items(id) ON DELETE RESTRICT,
  plaintext_sha256 TEXT NOT NULL CHECK (length(plaintext_sha256) = 64 AND plaintext_sha256 NOT GLOB '*[^0-9a-f]*'),
  submitted_by_account_id TEXT NOT NULL REFERENCES system_accounts(id) ON DELETE RESTRICT,
  command_id TEXT NOT NULL REFERENCES system_work_item_revisions(command_id) ON DELETE RESTRICT,
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  CHECK (length(attachment_id) = 36 AND attachment_id NOT GLOB '*[^0-9a-f-]*' AND substr(attachment_id, 9, 1) = '-' AND substr(attachment_id, 14, 1) = '-' AND substr(attachment_id, 19, 1) = '-' AND substr(attachment_id, 24, 1) = '-' AND length(replace(attachment_id, '-', '')) = 32 AND substr(attachment_id, 15, 1) GLOB '[1-8]' AND substr(attachment_id, 20, 1) GLOB '[89ab]')
);
INSERT INTO system_work_evidence (attachment_id, work_item_id, plaintext_sha256, submitted_by_account_id, command_id, created_at)
SELECT source.attachment_id,
       source.work_item_id,
       source.plaintext_sha256,
       source.submitted_by_account_id,
       source.command_id,
       source.created_at
FROM "_stage_system_work_evidence" source;
INSERT INTO _system_infrastructure_uuid_primary_key_validation
SELECT 'system_work_evidence',
       (SELECT count(*) FROM "_stage_system_work_evidence"),
       (SELECT count(*) FROM system_work_evidence),
       0,
       (SELECT count(*) FROM system_work_evidence WHERE NOT (length(attachment_id) = 36 AND attachment_id NOT GLOB '*[^0-9a-f-]*' AND substr(attachment_id, 9, 1) = '-' AND substr(attachment_id, 14, 1) = '-' AND substr(attachment_id, 19, 1) = '-' AND substr(attachment_id, 24, 1) = '-' AND length(replace(attachment_id, '-', '')) = 32 AND substr(attachment_id, 15, 1) GLOB '[1-8]' AND substr(attachment_id, 20, 1) GLOB '[89ab]')),
       0;
DROP TABLE "_stage_system_work_evidence";
CREATE INDEX system_work_evidence_work_idx ON system_work_evidence(work_item_id, attachment_id);
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
CREATE TRIGGER system_work_evidence_update BEFORE UPDATE ON system_work_evidence
BEGIN
  SELECT RAISE(ABORT, 'work item records are immutable');
END;
CREATE TRIGGER system_work_evidence_delete BEFORE DELETE ON system_work_evidence
BEGIN
  SELECT RAISE(ABORT, 'work item records are immutable');
END;

-- system_batch_jobs
CREATE TABLE system_batch_jobs (
  id TEXT PRIMARY KEY NOT NULL,
  legacy_id TEXT UNIQUE,
  name TEXT NOT NULL
    CHECK (length(name) BETWEEN 1 AND 200),
  status TEXT NOT NULL
    CHECK (status IN ('running', 'completed', 'failed')),
  started_at INTEGER,
  finished_at INTEGER,
  message TEXT,
  CHECK (finished_at IS NULL OR started_at IS NULL OR finished_at >= started_at),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO system_batch_jobs (id, name, status, started_at, finished_at, message, legacy_id)
SELECT map.new_id,
       source.name,
       source.status,
       source.started_at,
       source.finished_at,
       source.message,
       CAST(source.id AS TEXT)
FROM "_stage_system_batch_jobs" source
INNER JOIN _system_batch_jobs_id_map map ON map.old_id = source.id;
INSERT INTO _system_infrastructure_uuid_primary_key_validation
SELECT 'system_batch_jobs',
       (SELECT count(*) FROM "_stage_system_batch_jobs"),
       (SELECT count(*) FROM system_batch_jobs),
       0,
       (SELECT count(*) FROM system_batch_jobs WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       0;
DROP TABLE "_stage_system_batch_jobs";
CREATE INDEX system_batch_jobs_status_idx
  ON system_batch_jobs (status, id);
CREATE TRIGGER system_batch_jobs_legacy_id_insert
BEFORE INSERT ON system_batch_jobs
WHEN NEW.legacy_id IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'record_legacy_id_immutable'); END;
CREATE TRIGGER system_batch_jobs_identity_update
BEFORE UPDATE OF id, legacy_id ON system_batch_jobs
WHEN NEW.id IS NOT OLD.id OR NEW.legacy_id IS NOT OLD.legacy_id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

-- system_operation_receipts
CREATE TABLE system_operation_receipts (
  id TEXT PRIMARY KEY NOT NULL,
  operation_key TEXT NOT NULL CHECK (length(operation_key) BETWEEN 1 AND 255),
  scope_key TEXT NOT NULL CHECK (length(scope_key) BETWEEN 1 AND 255),
  command_id TEXT NOT NULL CHECK (length(command_id) BETWEEN 1 AND 255),
  actor_account_id TEXT NOT NULL CHECK (length(actor_account_id) BETWEEN 1 AND 255),
  actor_principal_id TEXT NOT NULL CHECK (length(actor_principal_id) BETWEEN 1 AND 255),
  request_digest TEXT NOT NULL CHECK (length(request_digest) = 64 AND request_digest NOT GLOB '*[^0-9a-f]*'),
  result_json TEXT NOT NULL CHECK (json_valid(result_json) AND length(CAST(result_json AS BLOB)) <= 1000000),
  result_digest TEXT NOT NULL CHECK (length(result_digest) = 64 AND result_digest NOT GLOB '*[^0-9a-f]*'),
  recorded_at INTEGER NOT NULL CHECK (typeof(recorded_at) = 'integer' AND recorded_at >= 0 AND recorded_at <= 9007199254740991),
  UNIQUE (operation_key, scope_key, command_id),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
INSERT INTO system_operation_receipts (id, operation_key, scope_key, command_id, actor_account_id, actor_principal_id, request_digest, result_json, result_digest, recorded_at)
SELECT lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))),
       source.operation_key,
       source.scope_key,
       source.command_id,
       source.actor_account_id,
       source.actor_principal_id,
       source.request_digest,
       source.result_json,
       source.result_digest,
       source.recorded_at
FROM "_stage_system_operation_receipts" source;
INSERT INTO _system_infrastructure_uuid_primary_key_validation
SELECT 'system_operation_receipts',
       (SELECT count(*) FROM "_stage_system_operation_receipts"),
       (SELECT count(*) FROM system_operation_receipts),
       0,
       (SELECT count(*) FROM system_operation_receipts WHERE NOT (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')),
       0;
DROP TABLE "_stage_system_operation_receipts";
CREATE INDEX system_operation_receipts_actor_idx ON system_operation_receipts (actor_account_id, recorded_at);
CREATE TRIGGER system_operation_receipts_no_update BEFORE UPDATE ON system_operation_receipts
BEGIN SELECT RAISE(ABORT, 'system operation receipt is immutable'); END;
CREATE TRIGGER system_operation_receipts_no_delete BEFORE DELETE ON system_operation_receipts
BEGIN SELECT RAISE(ABORT, 'system operation receipt is immutable'); END;
CREATE TRIGGER system_operation_receipts_identity_update
BEFORE UPDATE OF id ON system_operation_receipts
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

DROP TABLE _system_attachments_id_map;
DROP TABLE _system_attachment_preservations_id_map;
DROP TABLE _system_preserved_records_id_map;
DROP TABLE _system_record_source_freezes_id_map;
DROP TABLE _system_record_coverage_pages_id_map;
DROP TABLE _system_record_retirement_plans_id_map;
DROP TABLE _system_record_retirement_receipts_id_map;
DROP TABLE _system_record_source_retirements_id_map;
DROP TABLE _system_connectors_id_map;
DROP TABLE _system_integration_exchanges_id_map;
DROP TABLE _system_external_assertions_id_map;
DROP TABLE _system_reconciliation_runs_id_map;
DROP TABLE _system_jobs_id_map;
DROP TABLE _system_outbox_messages_id_map;
DROP TABLE _system_inbox_messages_id_map;
DROP TABLE _system_dead_letters_id_map;
DROP TABLE _system_notification_messages_id_map;
DROP TABLE _system_notification_deliveries_id_map;
DROP TABLE _system_work_items_id_map;
DROP TABLE _system_batch_jobs_id_map;
DROP TABLE _system_infrastructure_uuid_primary_key_validation;
