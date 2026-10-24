ALTER TABLE system_jobs ADD COLUMN handler_key TEXT CHECK (handler_key IS NULL OR length(handler_key) BETWEEN 1 AND 200);
ALTER TABLE system_outbox_messages ADD COLUMN handler_key TEXT CHECK (handler_key IS NULL OR length(handler_key) BETWEEN 1 AND 200);

DROP TRIGGER IF EXISTS system_jobs_handler_immutable;

CREATE TRIGGER system_jobs_handler_immutable
BEFORE UPDATE ON system_jobs
WHEN NEW.handler_key IS NOT OLD.handler_key
BEGIN
  SELECT RAISE(ABORT, 'system_delivery_handler_immutable');
END;

DROP TRIGGER IF EXISTS system_outbox_handler_immutable;

CREATE TRIGGER system_outbox_handler_immutable
BEFORE UPDATE ON system_outbox_messages
WHEN NEW.handler_key IS NOT OLD.handler_key
BEGIN
  SELECT RAISE(ABORT, 'system_delivery_handler_immutable');
END;

CREATE INDEX system_jobs_handler_claim_idx ON system_jobs(handler_key, status, available_at, id);
CREATE INDEX system_outbox_handler_claim_idx ON system_outbox_messages(handler_key, status, available_at, id);
