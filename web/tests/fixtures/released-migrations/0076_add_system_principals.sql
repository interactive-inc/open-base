CREATE TABLE system_principals (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) BETWEEN 1 AND 255),
  account_id TEXT NOT NULL UNIQUE REFERENCES system_accounts(id) ON DELETE RESTRICT,
  kind TEXT NOT NULL CHECK (kind IN ('human', 'agent', 'service', 'connector')),
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 200 AND trim(name) = name),
  connector_id TEXT REFERENCES system_connectors(id) ON DELETE RESTRICT,
  revision INTEGER NOT NULL CHECK (revision >= 1),
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  updated_at INTEGER NOT NULL CHECK (updated_at >= created_at),
  CHECK ((kind = 'connector') = (connector_id IS NOT NULL))
);

CREATE UNIQUE INDEX system_principals_connector_uniq ON system_principals (connector_id);
CREATE INDEX system_principals_kind_idx ON system_principals (kind, id);

INSERT INTO system_principals
  (id, account_id, kind, name, connector_id, revision, created_at, updated_at)
SELECT 'principal:' || account.id, account.id, 'human', account.id, NULL, 1,
       account.created_at, account.updated_at
FROM system_accounts AS account;

CREATE TABLE system_machine_credentials (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) BETWEEN 1 AND 255),
  principal_id TEXT NOT NULL REFERENCES system_principals(id) ON DELETE RESTRICT,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 200 AND trim(name) = name),
  secret_hash TEXT NOT NULL UNIQUE CHECK (
    length(secret_hash) = 64 AND secret_hash NOT GLOB '*[^0-9a-f]*'
  ),
  status TEXT NOT NULL CHECK (status IN ('active', 'revoked')),
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  updated_at INTEGER NOT NULL CHECK (updated_at >= created_at),
  expires_at INTEGER CHECK (expires_at IS NULL OR expires_at > created_at),
  last_used_at INTEGER CHECK (
    last_used_at IS NULL OR (last_used_at >= created_at AND last_used_at <= updated_at)
  ),
  revoked_at INTEGER CHECK (revoked_at IS NULL OR revoked_at = updated_at),
  CHECK ((status = 'revoked') = (revoked_at IS NOT NULL))
);

CREATE INDEX system_machine_credentials_principal_idx
  ON system_machine_credentials (principal_id, status);
CREATE INDEX system_machine_credentials_expiration_idx
  ON system_machine_credentials (expires_at);

CREATE TABLE system_step_up_grants (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) BETWEEN 1 AND 255),
  account_id TEXT NOT NULL REFERENCES system_accounts(id) ON DELETE RESTRICT,
  token_hash TEXT NOT NULL UNIQUE CHECK (
    length(token_hash) = 64 AND token_hash NOT GLOB '*[^0-9a-f]*'
  ),
  method TEXT NOT NULL CHECK (method IN ('password', 'external_identity')),
  issued_at INTEGER NOT NULL CHECK (issued_at >= 0),
  expires_at INTEGER NOT NULL CHECK (expires_at > issued_at),
  last_used_at INTEGER CHECK (
    last_used_at IS NULL OR (last_used_at >= issued_at AND last_used_at < expires_at)
  ),
  revoked_at INTEGER CHECK (
    revoked_at IS NULL OR (revoked_at >= issued_at AND revoked_at < expires_at)
  )
);

CREATE INDEX system_step_up_grants_account_idx
  ON system_step_up_grants (account_id, expires_at);

DROP TRIGGER IF EXISTS system_principals_revision_step;

CREATE TRIGGER system_principals_revision_step
BEFORE UPDATE ON system_principals
WHEN NEW.revision <> OLD.revision + 1 OR NEW.updated_at < OLD.updated_at
BEGIN
  SELECT RAISE(ABORT, 'system_principal_revision_conflict');
END;

DROP TRIGGER IF EXISTS system_machine_credentials_principal_guard;

CREATE TRIGGER system_machine_credentials_principal_guard
BEFORE INSERT ON system_machine_credentials
WHEN NOT EXISTS (
  SELECT 1 FROM system_principals AS principal
  INNER JOIN system_accounts AS account ON account.id = principal.account_id
  WHERE principal.id = NEW.principal_id
    AND principal.kind IN ('agent', 'service', 'connector')
    AND account.status = 'active'
)
BEGIN
  SELECT RAISE(ABORT, 'system_machine_credential_principal_invalid');
END;

DROP TRIGGER IF EXISTS system_machine_credentials_monotonic_update;

CREATE TRIGGER system_machine_credentials_monotonic_update
BEFORE UPDATE ON system_machine_credentials
WHEN NEW.principal_id <> OLD.principal_id
  OR NEW.secret_hash <> OLD.secret_hash
  OR NEW.created_at <> OLD.created_at
  OR NEW.updated_at < OLD.updated_at
  OR (OLD.status = 'revoked' AND NEW.status <> 'revoked')
  OR (OLD.last_used_at IS NOT NULL AND (NEW.last_used_at IS NULL OR NEW.last_used_at < OLD.last_used_at))
BEGIN
  SELECT RAISE(ABORT, 'system_machine_credential_update_invalid');
END;

DROP TRIGGER IF EXISTS system_machine_credentials_no_delete;

CREATE TRIGGER system_machine_credentials_no_delete
BEFORE DELETE ON system_machine_credentials
BEGIN
  SELECT RAISE(ABORT, 'system_machine_credentials_are_retained');
END;

DROP TRIGGER IF EXISTS system_step_up_grants_monotonic_update;

CREATE TRIGGER system_step_up_grants_monotonic_update
BEFORE UPDATE ON system_step_up_grants
WHEN NEW.account_id <> OLD.account_id
  OR NEW.token_hash <> OLD.token_hash
  OR NEW.method <> OLD.method
  OR NEW.issued_at <> OLD.issued_at
  OR NEW.expires_at <> OLD.expires_at
  OR (OLD.last_used_at IS NOT NULL AND (NEW.last_used_at IS NULL OR NEW.last_used_at < OLD.last_used_at))
  OR (OLD.revoked_at IS NOT NULL AND NEW.revoked_at <> OLD.revoked_at)
BEGIN
  SELECT RAISE(ABORT, 'system_step_up_grant_update_invalid');
END;

DROP TRIGGER IF EXISTS system_step_up_grants_no_delete;

CREATE TRIGGER system_step_up_grants_no_delete
BEFORE DELETE ON system_step_up_grants
BEGIN
  SELECT RAISE(ABORT, 'system_step_up_grants_are_retained');
END;
