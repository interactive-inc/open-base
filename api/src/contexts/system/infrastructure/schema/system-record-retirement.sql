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
  CHECK(json_array_length(snapshot_json,'$.coverage') IS json_array_length(snapshot_json,'$.capability.recordKinds'))
);

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
  CHECK(json_extract(snapshot_json,'$.auditEventId') IS audit_event_id)
);

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

CREATE TABLE system_record_retirement_attachment_pins (
  -- 撤去の trigger が行を足すため、主キーは列の既定値で採番する。
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  receipt_id TEXT NOT NULL REFERENCES system_record_retirement_receipts(id),
  attachment_id TEXT NOT NULL,
  UNIQUE(receipt_id,attachment_id),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TRIGGER system_record_retirement_attachment_pins_identity_update
BEFORE UPDATE OF id ON system_record_retirement_attachment_pins
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;
CREATE INDEX system_record_retirement_attachment_pins_attachment_idx
  ON system_record_retirement_attachment_pins(attachment_id,receipt_id);

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
