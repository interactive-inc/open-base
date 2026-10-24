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
  completed_at INTEGER,
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
  )
);

CREATE UNIQUE INDEX system_jobs_idempotency_uniq ON system_jobs (operation_key, idempotency_key);
CREATE INDEX system_jobs_claim_idx ON system_jobs (status, available_at, id);
CREATE INDEX system_jobs_lease_idx ON system_jobs (status, lease_expires_at);

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
  completed_at INTEGER,
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
  )
);

CREATE UNIQUE INDEX system_outbox_messages_idempotency_uniq
  ON system_outbox_messages (topic, idempotency_key);
CREATE INDEX system_outbox_messages_claim_idx ON system_outbox_messages (status, available_at, id);
CREATE INDEX system_outbox_messages_lease_idx ON system_outbox_messages (status, lease_expires_at);

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
  )
);

CREATE UNIQUE INDEX system_inbox_messages_external_uniq
  ON system_inbox_messages (source_key, external_message_id);
CREATE INDEX system_inbox_messages_status_idx ON system_inbox_messages (status, received_at);

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
  CHECK (requeued_at IS NULL OR requeued_at >= recorded_at)
);

CREATE UNIQUE INDEX system_dead_letters_source_uniq ON system_dead_letters (source_type, source_id);
CREATE INDEX system_dead_letters_recorded_idx ON system_dead_letters (recorded_at, id);

DROP TRIGGER IF EXISTS system_jobs_monotonic_update;

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

DROP TRIGGER IF EXISTS system_jobs_no_delete;

CREATE TRIGGER system_jobs_no_delete BEFORE DELETE ON system_jobs
BEGIN SELECT RAISE(ABORT, 'system_jobs_are_retained'); END;

DROP TRIGGER IF EXISTS system_outbox_messages_monotonic_update;

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

DROP TRIGGER IF EXISTS system_outbox_messages_no_delete;

CREATE TRIGGER system_outbox_messages_no_delete BEFORE DELETE ON system_outbox_messages
BEGIN SELECT RAISE(ABORT, 'system_outbox_messages_are_retained'); END;

DROP TRIGGER IF EXISTS system_inbox_messages_monotonic_update;

CREATE TRIGGER system_inbox_messages_monotonic_update
BEFORE UPDATE ON system_inbox_messages
WHEN NEW.id <> OLD.id OR NEW.source_key <> OLD.source_key
  OR NEW.external_message_id <> OLD.external_message_id OR NEW.payload_digest <> OLD.payload_digest
  OR NEW.received_at <> OLD.received_at OR OLD.status <> 'accepted'
  OR NEW.status = 'accepted'
BEGIN
  SELECT RAISE(ABORT, 'system_inbox_update_invalid');
END;

DROP TRIGGER IF EXISTS system_inbox_messages_no_delete;

CREATE TRIGGER system_inbox_messages_no_delete BEFORE DELETE ON system_inbox_messages
BEGIN SELECT RAISE(ABORT, 'system_inbox_messages_are_retained'); END;

DROP TRIGGER IF EXISTS system_dead_letters_source_guard;

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

DROP TRIGGER IF EXISTS system_dead_letters_monotonic_update;

CREATE TRIGGER system_dead_letters_monotonic_update
BEFORE UPDATE ON system_dead_letters
WHEN NEW.id <> OLD.id OR NEW.source_type <> OLD.source_type OR NEW.source_id <> OLD.source_id
  OR NEW.payload_digest <> OLD.payload_digest OR NEW.reason_code <> OLD.reason_code
  OR NEW.attempt <> OLD.attempt OR NEW.recorded_at <> OLD.recorded_at
  OR OLD.requeued_at IS NOT NULL OR NEW.requeued_at IS NULL OR NEW.requeued_job_id IS NULL
BEGIN
  SELECT RAISE(ABORT, 'system_dead_letter_update_invalid');
END;

DROP TRIGGER IF EXISTS system_dead_letters_no_delete;

CREATE TRIGGER system_dead_letters_no_delete BEFORE DELETE ON system_dead_letters
BEGIN SELECT RAISE(ABORT, 'system_dead_letters_are_retained'); END;
