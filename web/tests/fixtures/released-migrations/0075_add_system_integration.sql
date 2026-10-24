CREATE TABLE system_connectors (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) BETWEEN 1 AND 255),
  key TEXT NOT NULL UNIQUE CHECK (length(key) BETWEEN 1 AND 63),
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 200 AND trim(name) = name),
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound', 'bidirectional')),
  transport TEXT NOT NULL CHECK (transport IN ('api', 'file', 'webhook')),
  status TEXT NOT NULL CHECK (status IN ('active', 'disabled')),
  revision INTEGER NOT NULL CHECK (revision >= 1),
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  updated_at INTEGER NOT NULL CHECK (updated_at >= created_at)
);

CREATE INDEX system_connectors_status_idx ON system_connectors (status, key);

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
  CHECK ((status = 'pending' AND completed_at IS NULL) OR (status <> 'pending' AND completed_at IS NOT NULL))
);

CREATE UNIQUE INDEX system_integration_exchanges_idempotency_uniq
  ON system_integration_exchanges (connector_id, idempotency_key);
CREATE INDEX system_integration_exchanges_status_idx
  ON system_integration_exchanges (connector_id, status, updated_at);

CREATE TABLE system_external_assertions (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) BETWEEN 1 AND 255),
  connector_id TEXT NOT NULL REFERENCES system_connectors(id) ON DELETE RESTRICT,
  exchange_id TEXT REFERENCES system_integration_exchanges(id) ON DELETE RESTRICT,
  external_key TEXT NOT NULL CHECK (length(external_key) BETWEEN 1 AND 512),
  external_version TEXT NOT NULL CHECK (length(external_version) BETWEEN 1 AND 255),
  payload_digest TEXT NOT NULL CHECK (length(payload_digest) = 64 AND payload_digest NOT GLOB '*[^0-9a-f]*'),
  observed_at INTEGER NOT NULL CHECK (observed_at >= 0),
  received_at INTEGER NOT NULL CHECK (received_at >= observed_at)
);

CREATE UNIQUE INDEX system_external_assertions_version_uniq
  ON system_external_assertions (connector_id, external_key, external_version);
CREATE INDEX system_external_assertions_exchange_idx
  ON system_external_assertions (exchange_id, received_at);

CREATE TABLE system_reconciliation_runs (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) BETWEEN 1 AND 255),
  exchange_id TEXT NOT NULL REFERENCES system_integration_exchanges(id) ON DELETE RESTRICT,
  assertion_id TEXT NOT NULL REFERENCES system_external_assertions(id) ON DELETE RESTRICT,
  local_version TEXT NOT NULL CHECK (length(local_version) BETWEEN 1 AND 255),
  status TEXT NOT NULL CHECK (status IN ('matched', 'mismatched')),
  created_at INTEGER NOT NULL CHECK (created_at >= 0)
);

CREATE UNIQUE INDEX system_reconciliation_runs_input_uniq
  ON system_reconciliation_runs (exchange_id, assertion_id, local_version);
CREATE INDEX system_reconciliation_runs_status_idx
  ON system_reconciliation_runs (status, created_at);

CREATE TABLE system_reconciliation_items (
  run_id TEXT NOT NULL REFERENCES system_reconciliation_runs(id) ON DELETE RESTRICT,
  item_key TEXT NOT NULL CHECK (length(item_key) BETWEEN 1 AND 512),
  local_digest TEXT CHECK (local_digest IS NULL OR (length(local_digest) = 64 AND local_digest NOT GLOB '*[^0-9a-f]*')),
  external_digest TEXT CHECK (external_digest IS NULL OR (length(external_digest) = 64 AND external_digest NOT GLOB '*[^0-9a-f]*')),
  status TEXT NOT NULL CHECK (status IN ('matched', 'different', 'missing_local', 'missing_external')),
  PRIMARY KEY (run_id, item_key),
  CHECK (
    (status = 'matched' AND local_digest = external_digest AND local_digest IS NOT NULL)
    OR (status = 'different' AND local_digest <> external_digest AND local_digest IS NOT NULL AND external_digest IS NOT NULL)
    OR (status = 'missing_local' AND local_digest IS NULL AND external_digest IS NOT NULL)
    OR (status = 'missing_external' AND local_digest IS NOT NULL AND external_digest IS NULL)
  )
);

DROP TRIGGER IF EXISTS system_connectors_revision_step;

CREATE TRIGGER system_connectors_revision_step
BEFORE UPDATE ON system_connectors
WHEN NEW.revision <> OLD.revision + 1 OR NEW.updated_at < OLD.updated_at
BEGIN
  SELECT RAISE(ABORT, 'system_connector_revision_conflict');
END;

DROP TRIGGER IF EXISTS system_external_assertions_no_update;

CREATE TRIGGER system_external_assertions_no_update
BEFORE UPDATE ON system_external_assertions
BEGIN
  SELECT RAISE(ABORT, 'system_external_assertions_are_immutable');
END;

DROP TRIGGER IF EXISTS system_external_assertions_no_delete;

CREATE TRIGGER system_external_assertions_no_delete
BEFORE DELETE ON system_external_assertions
BEGIN
  SELECT RAISE(ABORT, 'system_external_assertions_are_immutable');
END;

DROP TRIGGER IF EXISTS system_reconciliation_runs_no_update;

CREATE TRIGGER system_reconciliation_runs_no_update
BEFORE UPDATE ON system_reconciliation_runs
BEGIN
  SELECT RAISE(ABORT, 'system_reconciliation_runs_are_immutable');
END;

DROP TRIGGER IF EXISTS system_reconciliation_runs_no_delete;

CREATE TRIGGER system_reconciliation_runs_no_delete
BEFORE DELETE ON system_reconciliation_runs
BEGIN
  SELECT RAISE(ABORT, 'system_reconciliation_runs_are_immutable');
END;

DROP TRIGGER IF EXISTS system_reconciliation_items_no_update;

CREATE TRIGGER system_reconciliation_items_no_update
BEFORE UPDATE ON system_reconciliation_items
BEGIN
  SELECT RAISE(ABORT, 'system_reconciliation_items_are_immutable');
END;

DROP TRIGGER IF EXISTS system_reconciliation_items_no_delete;

CREATE TRIGGER system_reconciliation_items_no_delete
BEFORE DELETE ON system_reconciliation_items
BEGIN
  SELECT RAISE(ABORT, 'system_reconciliation_items_are_immutable');
END;
