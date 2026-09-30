-- 監査の記録を UUID の主キーで作り直す (Issue )。
--
-- 対象: system_audit_events, company_audit_events, company_audit_event_appends,
-- company_audit_event_employee_contexts, company_audit_append_guard, company_audit_batch_decisions,
-- system_audit_disclosure_policy_revisions
--
-- 監査の記録は消してよいと決めたため、既存の行は移さずに table を空で作り直す。機能と書込み経路は変えない。
-- 監査の行を指す記録（保全、撤去、照合、開示方針、作業の版、休暇の判断通知、Company の責任の移行）が
-- 1 行でもあれば、検証表の CHECK で止める。指す先の監査を消すと証跡の結び付きが切れるため。
--
-- - system_audit_events: 主キーの event_id に UUID の CHECK を課す
-- - company_audit_events: 整数の id を UUID に替える。行は追記用の table からの trigger で入るため、
--   id は列の既定値で採番する。event_id も UUID に揃える
-- - company_audit_event_employee_contexts と company_audit_append_guard は監査の id を UUID で持つ
-- - company_audit_event_appends: 追記用の一時行の主キーを UUID の既定値にする
-- - company_audit_batch_decisions: decision_id は呼び出し側が UUID で渡す。CHECK を UUID に揃える
-- - system_audit_disclosure_policy_revisions: 整数の連番の代わりに UUID の id を主キーにする。
--   版の変化の検知は、削除も更新もできない table の行数で行う

CREATE TABLE _audit_uuid_primary_key_validation (
  resource TEXT PRIMARY KEY NOT NULL,
  referencing_count INTEGER NOT NULL,
  CHECK (referencing_count = 0)
);
INSERT INTO _audit_uuid_primary_key_validation
SELECT 'system_audit_events',
       (SELECT count(*) FROM system_attachment_preservations)
       + (SELECT count(*) FROM system_audit_disclosure_policy_revisions)
       + (SELECT count(*) FROM system_work_item_revisions WHERE audit_event_id IS NOT NULL)
       + (SELECT count(*) FROM system_record_disclosure_policies)
       + (SELECT count(*) FROM system_preserved_records)
       + (SELECT count(*) FROM system_record_source_freezes)
       + (SELECT count(*) FROM system_record_coverage_pages)
       + (SELECT count(*) FROM system_record_retirement_plans)
       + (SELECT count(*) FROM system_record_retirement_receipts)
       + (SELECT count(*) FROM system_record_source_retirements)
       + (SELECT count(*) FROM leave_decision_notifications);
INSERT INTO _audit_uuid_primary_key_validation
SELECT 'company_audit_events', (SELECT count(*) FROM company_responsibility_source_cutovers);

DROP VIEW company_audit_event_details;
DROP TABLE company_audit_event_appends;
DROP TABLE company_audit_event_employee_contexts;
DROP TABLE company_audit_append_guard;
DROP TABLE company_audit_events;
DROP TABLE company_audit_batch_decisions;
DROP TABLE system_audit_disclosure_policy_revisions;
DROP TABLE system_audit_events;

CREATE TABLE system_audit_events (
  event_id TEXT PRIMARY KEY NOT NULL,
  actor_account_id TEXT,
  action TEXT NOT NULL
    CHECK (length(action) BETWEEN 3 AND 200),
  target_type TEXT NOT NULL
    CHECK (length(target_type) BETWEEN 1 AND 200),
  target_id TEXT,
  outcome TEXT NOT NULL
    CHECK (outcome IN ('succeeded', 'denied', 'failed')),
  reason_code TEXT,
  authorization_json TEXT,
  before_json TEXT,
  after_json TEXT,
  metadata_json TEXT,
  occurred_at INTEGER NOT NULL,
  CHECK (authorization_json IS NULL OR json_valid(authorization_json)),
  CHECK (before_json IS NULL OR json_valid(before_json)),
  CHECK (after_json IS NULL OR json_valid(after_json)),
  CHECK (metadata_json IS NULL OR json_valid(metadata_json)),
  CHECK (length(event_id) = 36 AND event_id NOT GLOB '*[^0-9a-f-]*' AND substr(event_id, 9, 1) = '-' AND substr(event_id, 14, 1) = '-' AND substr(event_id, 19, 1) = '-' AND substr(event_id, 24, 1) = '-' AND length(replace(event_id, '-', '')) = 32 AND substr(event_id, 15, 1) GLOB '[1-8]' AND substr(event_id, 20, 1) GLOB '[89ab]')
);
CREATE INDEX system_audit_events_action_idx
  ON system_audit_events (action, occurred_at);
CREATE INDEX system_audit_events_actor_idx
  ON system_audit_events (actor_account_id, occurred_at);
CREATE INDEX system_audit_events_outcome_idx
  ON system_audit_events (outcome, occurred_at);
CREATE INDEX system_audit_events_target_idx
  ON system_audit_events (target_type, target_id, occurred_at);
CREATE TRIGGER system_audit_events_prevent_delete
BEFORE DELETE ON system_audit_events
BEGIN
  SELECT RAISE(ABORT, 'system audit event is append-only');
END;
CREATE TRIGGER system_audit_events_prevent_update
BEFORE UPDATE ON system_audit_events
BEGIN
  SELECT RAISE(ABORT, 'system audit event is append-only');
END;

CREATE TABLE system_audit_disclosure_policy_revisions (
  id TEXT PRIMARY KEY NOT NULL,
  scope TEXT NOT NULL CHECK (length(scope) BETWEEN 1 AND 255),
  revision INTEGER NOT NULL CHECK (revision > 0),
  command_id TEXT NOT NULL UNIQUE,
  enabled INTEGER NOT NULL CHECK (enabled IN (0, 1)),
  allowed_fields_json TEXT NOT NULL CHECK (json_valid(allowed_fields_json) AND json_type(allowed_fields_json) = 'array'),
  allowed_target_types_json TEXT CHECK (allowed_target_types_json IS NULL OR (json_valid(allowed_target_types_json) AND json_type(allowed_target_types_json) = 'array')),
  allowed_purposes_json TEXT CHECK (allowed_purposes_json IS NULL OR (json_valid(allowed_purposes_json) AND json_type(allowed_purposes_json) = 'array')),
  expires_at INTEGER,
  reason TEXT NOT NULL CHECK (length(trim(reason)) BETWEEN 1 AND 1000),
  actor_account_id TEXT NOT NULL REFERENCES system_accounts(id) ON DELETE RESTRICT,
  recorded_at INTEGER NOT NULL CHECK (recorded_at >= 0),
  audit_event_id TEXT NOT NULL UNIQUE REFERENCES system_audit_events(event_id) ON DELETE RESTRICT,
  CHECK (expires_at IS NULL OR expires_at > recorded_at),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE UNIQUE INDEX system_audit_disclosure_scope_revision_uniq
  ON system_audit_disclosure_policy_revisions (scope, revision);
CREATE TRIGGER system_audit_disclosure_revision_insert
BEFORE INSERT ON system_audit_disclosure_policy_revisions
BEGIN
  SELECT RAISE(ABORT, 'audit_disclosure_revision_conflict')
  WHERE NEW.revision <> 1 + COALESCE((SELECT MAX(revision) FROM system_audit_disclosure_policy_revisions WHERE scope = NEW.scope), 0)
    OR NEW.recorded_at < COALESCE((SELECT MAX(recorded_at) FROM system_audit_disclosure_policy_revisions WHERE scope = NEW.scope), 0);
  SELECT RAISE(ABORT, 'audit_disclosure_scope_unavailable')
  WHERE NEW.scope <> '*' AND NOT EXISTS (SELECT 1 FROM system_accounts WHERE id = NEW.scope);
  SELECT RAISE(ABORT, 'audit_disclosure_fields_invalid')
  WHERE json_array_length(NEW.allowed_fields_json) > 7
    OR EXISTS (SELECT 1 FROM json_each(NEW.allowed_fields_json) WHERE type <> 'text' OR value NOT IN ('actor_account_id', 'target_id', 'reason_code', 'authorization_json', 'before_json', 'after_json', 'metadata_json'))
    OR (SELECT COUNT(*) FROM json_each(NEW.allowed_fields_json)) <> (SELECT COUNT(DISTINCT value) FROM json_each(NEW.allowed_fields_json));
  SELECT RAISE(ABORT, 'audit_disclosure_labels_invalid')
  WHERE json_array_length(NEW.allowed_target_types_json) > 64 OR json_array_length(NEW.allowed_purposes_json) > 64
    OR EXISTS (SELECT 1 FROM json_each(NEW.allowed_target_types_json) WHERE type <> 'text' OR length(trim(value)) NOT BETWEEN 1 AND 100)
    OR EXISTS (SELECT 1 FROM json_each(NEW.allowed_purposes_json) WHERE type <> 'text' OR length(trim(value)) NOT BETWEEN 1 AND 100);
  SELECT RAISE(ABORT, 'audit_disclosure_audit_mismatch')
  WHERE NOT EXISTS (
    SELECT 1 FROM system_audit_events audit
    WHERE audit.event_id = NEW.audit_event_id AND audit.actor_account_id = NEW.actor_account_id
      AND audit.action = 'system.audit.disclosure.published' AND audit.target_type = 'system:audit-disclosure-policy'
      AND audit.target_id = NEW.scope AND audit.outcome = 'succeeded' AND audit.occurred_at = NEW.recorded_at
      AND json_extract(audit.after_json, '$.scope') IS NEW.scope
      AND json_extract(audit.after_json, '$.revision') IS NEW.revision
      AND json_extract(audit.after_json, '$.commandId') IS NEW.command_id
      AND json_extract(audit.after_json, '$.enabled') IS NEW.enabled
      AND json_extract(audit.after_json, '$.allowedFields') IS NEW.allowed_fields_json
      AND json_extract(audit.after_json, '$.allowedTargetTypes') IS NEW.allowed_target_types_json
      AND json_extract(audit.after_json, '$.allowedPurposes') IS NEW.allowed_purposes_json
      AND json_extract(audit.after_json, '$.expiresAt') IS strftime('%Y-%m-%dT%H:%M:%fZ', NEW.expires_at / 1000.0, 'unixepoch')
      AND json_extract(audit.after_json, '$.reason') IS NEW.reason
      AND json_extract(audit.after_json, '$.actorAccountId') IS NEW.actor_account_id
      AND json_extract(audit.after_json, '$.recordedAt') IS strftime('%Y-%m-%dT%H:%M:%fZ', NEW.recorded_at / 1000.0, 'unixepoch')
      AND json_extract(audit.after_json, '$.auditEventId') IS NEW.audit_event_id
      AND ((NEW.revision = 1 AND audit.before_json IS NULL) OR (NEW.revision > 1 AND audit.before_json = (
        SELECT previous_audit.after_json FROM system_audit_disclosure_policy_revisions previous
        JOIN system_audit_events previous_audit ON previous_audit.event_id = previous.audit_event_id
        WHERE previous.scope = NEW.scope AND previous.revision = NEW.revision - 1
      )))
  );
END;
CREATE TRIGGER system_audit_disclosure_revision_update
BEFORE UPDATE ON system_audit_disclosure_policy_revisions
BEGIN
  SELECT RAISE(ABORT, 'audit disclosure revisions are immutable');
END;
CREATE TRIGGER system_audit_disclosure_revision_delete
BEFORE DELETE ON system_audit_disclosure_policy_revisions
BEGIN
  SELECT RAISE(ABORT, 'audit disclosure revisions are immutable');
END;

CREATE TABLE company_audit_events (
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  event_id TEXT NOT NULL UNIQUE,
  request_id TEXT NOT NULL,
  actor_account_id TEXT,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  outcome TEXT NOT NULL CHECK (outcome IN ('succeeded', 'denied', 'failed')),
  reason_code TEXT,
  authorization_json TEXT,
  before_json TEXT,
  after_json TEXT,
  metadata_json TEXT,
  client_ip TEXT,
  client_name TEXT NOT NULL CHECK (client_name IN ('web', 'cli', 'api', 'system')),
  created_at INTEGER NOT NULL,
  CHECK (actor_account_id IS NULL OR length(actor_account_id) BETWEEN 1 AND 255),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]'),
  CHECK (length(event_id) = 36 AND event_id NOT GLOB '*[^0-9a-f-]*' AND substr(event_id, 9, 1) = '-' AND substr(event_id, 14, 1) = '-' AND substr(event_id, 19, 1) = '-' AND substr(event_id, 24, 1) = '-' AND length(replace(event_id, '-', '')) = 32 AND substr(event_id, 15, 1) GLOB '[1-8]' AND substr(event_id, 20, 1) GLOB '[89ab]')
);
CREATE INDEX idx_company_audit_events_action
  ON company_audit_events(action, created_at, id);
CREATE INDEX idx_company_audit_events_actor
  ON company_audit_events(actor_account_id, created_at, id);
CREATE INDEX idx_company_audit_events_created
  ON company_audit_events(created_at, id);
CREATE INDEX idx_company_audit_events_outcome
  ON company_audit_events(outcome, created_at, id);
CREATE INDEX idx_company_audit_events_request
  ON company_audit_events(request_id);
CREATE INDEX idx_company_audit_events_target
  ON company_audit_events(target_type, target_id, created_at, id);

CREATE TABLE company_audit_append_guard (
  audit_id TEXT PRIMARY KEY NOT NULL,
  event_id TEXT NOT NULL UNIQUE,
  CHECK (length(audit_id) = 36 AND audit_id NOT GLOB '*[^0-9a-f-]*' AND substr(audit_id, 9, 1) = '-' AND substr(audit_id, 14, 1) = '-' AND substr(audit_id, 19, 1) = '-' AND substr(audit_id, 24, 1) = '-' AND length(replace(audit_id, '-', '')) = 32 AND substr(audit_id, 15, 1) GLOB '[1-8]' AND substr(audit_id, 20, 1) GLOB '[89ab]')
) WITHOUT ROWID;

CREATE TABLE company_audit_event_employee_contexts (
  audit_event_id TEXT PRIMARY KEY NOT NULL,
  employee_id TEXT NOT NULL,
  CHECK (length(audit_event_id) = 36 AND audit_event_id NOT GLOB '*[^0-9a-f-]*' AND substr(audit_event_id, 9, 1) = '-' AND substr(audit_event_id, 14, 1) = '-' AND substr(audit_event_id, 19, 1) = '-' AND substr(audit_event_id, 24, 1) = '-' AND length(replace(audit_event_id, '-', '')) = 32 AND substr(audit_event_id, 15, 1) GLOB '[1-8]' AND substr(audit_event_id, 20, 1) GLOB '[89ab]')
);
CREATE INDEX idx_company_audit_event_employee_contexts_employee
  ON company_audit_event_employee_contexts(employee_id, audit_event_id);

CREATE TABLE company_audit_event_appends (
  staging_id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  event_id TEXT NOT NULL,
  request_id TEXT NOT NULL,
  actor_account_id TEXT,
  actor_employee_id TEXT,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  outcome TEXT NOT NULL,
  reason_code TEXT,
  authorization_json TEXT,
  before_json TEXT,
  after_json TEXT,
  metadata_json TEXT,
  client_ip TEXT,
  client_name TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  CHECK (actor_account_id IS NULL OR length(actor_account_id) BETWEEN 1 AND 255),
  CHECK (length(staging_id) = 36 AND staging_id NOT GLOB '*[^0-9a-f-]*' AND substr(staging_id, 9, 1) = '-' AND substr(staging_id, 14, 1) = '-' AND substr(staging_id, 19, 1) = '-' AND substr(staging_id, 24, 1) = '-' AND length(replace(staging_id, '-', '')) = 32 AND substr(staging_id, 15, 1) GLOB '[1-8]' AND substr(staging_id, 20, 1) GLOB '[89ab]')
);

CREATE TABLE company_audit_batch_decisions (
  decision_id TEXT PRIMARY KEY NOT NULL,
  decision_value TEXT NOT NULL,
  CHECK (length(decision_value) BETWEEN 1 AND 64),
  CHECK (length(decision_id) = 36 AND decision_id NOT GLOB '*[^0-9a-f-]*' AND substr(decision_id, 9, 1) = '-' AND substr(decision_id, 14, 1) = '-' AND substr(decision_id, 19, 1) = '-' AND substr(decision_id, 24, 1) = '-' AND length(replace(decision_id, '-', '')) = 32 AND substr(decision_id, 15, 1) GLOB '[1-8]' AND substr(decision_id, 20, 1) GLOB '[89ab]')
) WITHOUT ROWID;

CREATE TRIGGER company_audit_events_prevent_delete
BEFORE DELETE ON company_audit_events
BEGIN
  SELECT RAISE(ABORT, 'company audit events are append only');
END;
CREATE TRIGGER company_audit_events_prevent_update
BEFORE UPDATE ON company_audit_events
BEGIN
  SELECT RAISE(ABORT, 'company audit events are append only');
END;
CREATE TRIGGER company_audit_events_register_insert
AFTER INSERT ON company_audit_events
BEGIN
  SELECT RAISE(ABORT, 'company audit events are append only')
  WHERE EXISTS (
    SELECT 1 FROM company_audit_append_guard
    WHERE audit_id = NEW.id OR event_id = NEW.event_id
  );

  INSERT INTO company_audit_append_guard (audit_id, event_id)
  VALUES (NEW.id, NEW.event_id);
END;
CREATE TRIGGER company_audit_append_guard_prevent_delete
BEFORE DELETE ON company_audit_append_guard
BEGIN
  SELECT RAISE(ABORT, 'company audit append guard is immutable');
END;
CREATE TRIGGER company_audit_append_guard_prevent_insert
BEFORE INSERT ON company_audit_append_guard
WHEN
  NOT EXISTS (
    SELECT 1 FROM company_audit_events
    WHERE id = NEW.audit_id AND event_id = NEW.event_id
  )
  OR EXISTS (
    SELECT 1 FROM company_audit_append_guard
    WHERE audit_id = NEW.audit_id OR event_id = NEW.event_id
  )
BEGIN
  SELECT RAISE(ABORT, 'company audit append guard is immutable');
END;
CREATE TRIGGER company_audit_append_guard_prevent_update
BEFORE UPDATE ON company_audit_append_guard
BEGIN
  SELECT RAISE(ABORT, 'company audit append guard is immutable');
END;
CREATE TRIGGER company_audit_event_employee_contexts_prevent_delete
BEFORE DELETE ON company_audit_event_employee_contexts
BEGIN
  SELECT RAISE(ABORT, 'company audit employee context is append only');
END;
CREATE TRIGGER company_audit_event_employee_contexts_prevent_update
BEFORE UPDATE ON company_audit_event_employee_contexts
BEGIN
  SELECT RAISE(ABORT, 'company audit employee context is append only');
END;
CREATE TRIGGER company_audit_event_employee_contexts_validate_insert
BEFORE INSERT ON company_audit_event_employee_contexts
WHEN NOT EXISTS (
  SELECT 1 FROM company_audit_events WHERE id = NEW.audit_event_id
)
BEGIN
  SELECT RAISE(ABORT, 'company audit employee context requires an audit event');
END;
CREATE TRIGGER company_audit_event_appends_dispatch
AFTER INSERT ON company_audit_event_appends
BEGIN
  INSERT INTO company_audit_events (
    event_id, request_id, actor_account_id, action, target_type, target_id, outcome,
    reason_code, authorization_json, before_json, after_json, metadata_json,
    client_ip, client_name, created_at
  ) VALUES (
    NEW.event_id, NEW.request_id, NEW.actor_account_id, NEW.action, NEW.target_type,
    NEW.target_id, NEW.outcome, NEW.reason_code, NEW.authorization_json, NEW.before_json,
    NEW.after_json, NEW.metadata_json, NEW.client_ip, NEW.client_name, NEW.created_at
  );

  INSERT INTO company_audit_event_employee_contexts (audit_event_id, employee_id)
  SELECT event.id, NEW.actor_employee_id
  FROM company_audit_events event
  WHERE event.event_id = NEW.event_id
    AND NEW.actor_employee_id IS NOT NULL;

  DELETE FROM company_audit_event_appends WHERE staging_id = NEW.staging_id;
END;

CREATE VIEW company_audit_event_details AS
SELECT
  event.id,
  event.event_id,
  event.request_id,
  event.actor_account_id,
  employee_context.employee_id AS actor_employee_id,
  event.action,
  event.target_type,
  event.target_id,
  event.outcome,
  event.reason_code,
  event.authorization_json,
  event.before_json,
  event.after_json,
  event.metadata_json,
  event.client_ip,
  event.client_name,
  event.created_at
FROM company_audit_events event
LEFT JOIN company_audit_event_employee_contexts employee_context
  ON employee_context.audit_event_id = event.id;

DROP TABLE _audit_uuid_primary_key_validation;
