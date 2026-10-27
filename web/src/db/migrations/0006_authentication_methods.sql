-- void:allow-destructive
-- パスキーと外部認証の登録を保ち、パスワード方式を選べる共有基盤へ進める。
-- 過去の移行で削除された資格情報は復元せず、新規登録のための保存先を作る。
--> statement-breakpoint

PRAGMA defer_foreign_keys = true;
--> statement-breakpoint

CREATE TABLE _auth_stage_system_identity_bindings AS SELECT id, account_id, provider, subject, created_at, activated_at, revoked_at FROM system_identity_bindings;
--> statement-breakpoint

CREATE TABLE _auth_stage_system_identity_profiles AS SELECT identity_id, email, email_verified, last_used_at, updated_at, can_receive_email FROM system_identity_profiles;
--> statement-breakpoint

CREATE TABLE _auth_stage_company_external_identity_sources AS SELECT identity_id, organization_id, source_revision, source_digest, updated_at FROM company_external_identity_sources;
--> statement-breakpoint

CREATE TABLE _auth_stage_system_passkey_enrollments AS SELECT id, account_id, identity_id, token_hash, reason, issued_by_account_id, created_at, expires_at, consumed_at, revoked_at FROM system_passkey_enrollments;
--> statement-breakpoint

SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM sqlite_master WHERE type = 'table' AND sql LIKE '%REFERENCES%system_identity_bindings%' AND name NOT IN ('system_identity_profiles', 'company_external_identity_sources', 'system_passkey_enrollments')) THEN 1 ELSE json_extract('', '$') END AS references_are_known;
--> statement-breakpoint

DROP TABLE system_identity_profiles;
--> statement-breakpoint

DROP TABLE company_external_identity_sources;
--> statement-breakpoint

DROP TABLE system_passkey_enrollments;
--> statement-breakpoint

DROP TABLE system_identity_bindings;
--> statement-breakpoint

CREATE TABLE system_identity_bindings (
  id TEXT PRIMARY KEY NOT NULL,
  account_id TEXT NOT NULL
    REFERENCES system_accounts(id) ON DELETE RESTRICT,
  provider TEXT NOT NULL
    CHECK (provider IN ('password', 'passkey', 'google', 'github', 'oidc')),
  subject TEXT NOT NULL
    CHECK (length(subject) BETWEEN 1 AND 2048),
  created_at INTEGER NOT NULL,
  activated_at INTEGER
    CHECK (activated_at IS NULL OR activated_at >= created_at),
  revoked_at INTEGER
    CHECK (
      revoked_at IS NULL OR (
        revoked_at >= created_at
        AND (activated_at IS NULL OR revoked_at >= activated_at)
      )
    ),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
--> statement-breakpoint

INSERT INTO system_identity_bindings (id, account_id, provider, subject, created_at, activated_at, revoked_at) SELECT id, account_id, provider, subject, created_at, activated_at, revoked_at FROM _auth_stage_system_identity_bindings;
--> statement-breakpoint

SELECT CASE WHEN (SELECT COUNT(*) FROM system_identity_bindings) = (SELECT COUNT(*) FROM _auth_stage_system_identity_bindings) THEN 1 ELSE json_extract('', '$') END AS restored_all_rows;
--> statement-breakpoint

CREATE TABLE system_identity_profiles (
  identity_id TEXT PRIMARY KEY NOT NULL
    REFERENCES system_identity_bindings(id) ON DELETE CASCADE,
  email TEXT
    CHECK (email IS NULL OR length(email) BETWEEN 3 AND 320),
  email_verified INTEGER NOT NULL DEFAULT 0
    CHECK (email_verified IN (0, 1)),
  last_used_at INTEGER,
  updated_at INTEGER NOT NULL
, can_receive_email INTEGER NOT NULL DEFAULT 1
  CHECK (can_receive_email IN (0, 1)),
  CHECK (length(identity_id) = 36 AND identity_id NOT GLOB '*[^0-9a-f-]*' AND substr(identity_id, 9, 1) = '-' AND substr(identity_id, 14, 1) = '-' AND substr(identity_id, 19, 1) = '-' AND substr(identity_id, 24, 1) = '-' AND length(replace(identity_id, '-', '')) = 32 AND substr(identity_id, 15, 1) GLOB '[1-8]' AND substr(identity_id, 20, 1) GLOB '[89ab]')
);
--> statement-breakpoint

INSERT INTO system_identity_profiles (identity_id, email, email_verified, last_used_at, updated_at, can_receive_email) SELECT identity_id, email, email_verified, last_used_at, updated_at, can_receive_email FROM _auth_stage_system_identity_profiles;
--> statement-breakpoint

SELECT CASE WHEN (SELECT COUNT(*) FROM system_identity_profiles) = (SELECT COUNT(*) FROM _auth_stage_system_identity_profiles) THEN 1 ELSE json_extract('', '$') END AS restored_all_rows;
--> statement-breakpoint

CREATE TABLE company_external_identity_sources (
  identity_id TEXT PRIMARY KEY NOT NULL REFERENCES system_identity_bindings(id) ON DELETE RESTRICT,
  organization_id TEXT NOT NULL REFERENCES company_organizations(id) ON DELETE RESTRICT,
  source_revision INTEGER NOT NULL CHECK (source_revision > 0),
  source_digest TEXT NOT NULL CHECK (length(source_digest) = 64 AND source_digest NOT GLOB '*[^0-9a-f]*'),
  updated_at INTEGER NOT NULL CHECK (updated_at >= 0),
  CHECK (length(identity_id) = 36 AND identity_id NOT GLOB '*[^0-9a-f-]*' AND substr(identity_id, 9, 1) = '-' AND substr(identity_id, 14, 1) = '-' AND substr(identity_id, 19, 1) = '-' AND substr(identity_id, 24, 1) = '-' AND length(replace(identity_id, '-', '')) = 32 AND substr(identity_id, 15, 1) GLOB '[1-8]' AND substr(identity_id, 20, 1) GLOB '[89ab]')
);
--> statement-breakpoint

INSERT INTO company_external_identity_sources (identity_id, organization_id, source_revision, source_digest, updated_at) SELECT identity_id, organization_id, source_revision, source_digest, updated_at FROM _auth_stage_company_external_identity_sources;
--> statement-breakpoint

SELECT CASE WHEN (SELECT COUNT(*) FROM company_external_identity_sources) = (SELECT COUNT(*) FROM _auth_stage_company_external_identity_sources) THEN 1 ELSE json_extract('', '$') END AS restored_all_rows;
--> statement-breakpoint

CREATE TABLE system_passkey_enrollments (
  id TEXT PRIMARY KEY NOT NULL,
  account_id TEXT NOT NULL REFERENCES system_accounts(id) ON DELETE RESTRICT,
  identity_id TEXT NOT NULL REFERENCES system_identity_bindings(id) ON DELETE RESTRICT,
  token_hash TEXT NOT NULL UNIQUE CHECK (
    length(token_hash) = 64 AND token_hash NOT GLOB '*[^0-9a-f]*'
  ),
  reason TEXT NOT NULL CHECK (reason IN ('bootstrap', 'provisioning', 'reissue', 'recovery')),
  issued_by_account_id TEXT REFERENCES system_accounts(id) ON DELETE RESTRICT,
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  expires_at INTEGER NOT NULL CHECK (expires_at > created_at),
  consumed_at INTEGER CHECK (
    consumed_at IS NULL OR (consumed_at >= created_at AND consumed_at < expires_at)
  ),
  revoked_at INTEGER CHECK (revoked_at IS NULL OR revoked_at >= created_at),
  CHECK (consumed_at IS NULL OR revoked_at IS NULL),
  CHECK ((reason IN ('bootstrap', 'recovery')) = (issued_by_account_id IS NULL)),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
--> statement-breakpoint

INSERT INTO system_passkey_enrollments (id, account_id, identity_id, token_hash, reason, issued_by_account_id, created_at, expires_at, consumed_at, revoked_at) SELECT id, account_id, identity_id, token_hash, reason, issued_by_account_id, created_at, expires_at, consumed_at, revoked_at FROM _auth_stage_system_passkey_enrollments;
--> statement-breakpoint

SELECT CASE WHEN (SELECT COUNT(*) FROM system_passkey_enrollments) = (SELECT COUNT(*) FROM _auth_stage_system_passkey_enrollments) THEN 1 ELSE json_extract('', '$') END AS restored_all_rows;
--> statement-breakpoint

CREATE TABLE system_browser_login_codes (
  code_hash TEXT PRIMARY KEY NOT NULL
    CHECK (length(code_hash) BETWEEN 32 AND 512),
  account_id TEXT NOT NULL
    REFERENCES system_accounts(id) ON DELETE CASCADE,
  token_version INTEGER NOT NULL
    CHECK (token_version >= 0),
  session_family_id TEXT
    CHECK (session_family_id IS NULL OR length(session_family_id) BETWEEN 1 AND 255),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  CHECK (expires_at > created_at)
);
--> statement-breakpoint

CREATE TABLE system_cli_login_codes (
  code_hash TEXT PRIMARY KEY NOT NULL
    CHECK (length(code_hash) BETWEEN 32 AND 512),
  account_id TEXT NOT NULL
    REFERENCES system_accounts(id) ON DELETE CASCADE,
  token_version INTEGER NOT NULL
    CHECK (token_version >= 0),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  CHECK (expires_at > created_at)
);
--> statement-breakpoint

CREATE TABLE system_cli_login_states (
  state TEXT PRIMARY KEY NOT NULL
    CHECK (length(state) BETWEEN 16 AND 512),
  port INTEGER NOT NULL
    CHECK (port BETWEEN 1 AND 65535),
  cli_state TEXT NOT NULL
    CHECK (length(cli_state) BETWEEN 1 AND 512),
  code_verifier TEXT NOT NULL
    CHECK (length(code_verifier) BETWEEN 43 AND 128),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  CHECK (expires_at > created_at)
);
--> statement-breakpoint

CREATE TABLE system_identity_login_tokens (
  jti TEXT PRIMARY KEY NOT NULL
    CHECK (length(jti) BETWEEN 1 AND 512),
  expires_at INTEGER NOT NULL,
  used_at INTEGER NOT NULL,
  CHECK (expires_at > used_at)
);
--> statement-breakpoint

CREATE TABLE system_oidc_access_tokens (
  token_hash TEXT PRIMARY KEY NOT NULL
    CHECK (length(token_hash) = 64 AND token_hash NOT GLOB '*[^0-9a-f]*'),
  issuer TEXT NOT NULL,
  client_id TEXT NOT NULL,
  account_id TEXT NOT NULL
    REFERENCES system_accounts(id) ON DELETE CASCADE,
  scope TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  CHECK (expires_at > created_at)
);
--> statement-breakpoint

CREATE TABLE system_oidc_authorization_codes (
  code_hash TEXT PRIMARY KEY NOT NULL
    CHECK (length(code_hash) = 64 AND code_hash NOT GLOB '*[^0-9a-f]*'),
  issuer TEXT NOT NULL,
  client_id TEXT NOT NULL,
  redirect_uri TEXT NOT NULL,
  account_id TEXT NOT NULL
    REFERENCES system_accounts(id) ON DELETE CASCADE,
  code_challenge TEXT NOT NULL,
  nonce TEXT NOT NULL,
  scope TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  CHECK (expires_at > created_at)
);
--> statement-breakpoint

CREATE TABLE system_password_credentials (
  identity_id TEXT PRIMARY KEY NOT NULL
    REFERENCES system_identity_bindings(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL
    CHECK (length(password_hash) BETWEEN 20 AND 4096),
  changed_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
    CHECK (changed_at >= created_at AND updated_at >= changed_at),
  CHECK (length(identity_id) = 36 AND identity_id NOT GLOB '*[^0-9a-f-]*' AND substr(identity_id, 9, 1) = '-' AND substr(identity_id, 14, 1) = '-' AND substr(identity_id, 19, 1) = '-' AND substr(identity_id, 24, 1) = '-' AND length(replace(identity_id, '-', '')) = 32 AND substr(identity_id, 15, 1) GLOB '[1-8]' AND substr(identity_id, 20, 1) GLOB '[89ab]')
);
--> statement-breakpoint

CREATE TABLE system_password_reset_challenges (
  id TEXT PRIMARY KEY NOT NULL,
  token_hash TEXT NOT NULL
    CHECK (length(token_hash) = 64 AND token_hash NOT GLOB '*[^0-9a-f]*'),
  account_id TEXT NOT NULL
    REFERENCES system_accounts(id) ON DELETE RESTRICT,
  identity_id TEXT NOT NULL
    REFERENCES system_identity_bindings(id) ON DELETE RESTRICT,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
    CHECK (expires_at > created_at),
  used_at INTEGER
    CHECK (used_at IS NULL OR used_at >= created_at),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
--> statement-breakpoint

CREATE TABLE system_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  account_id TEXT NOT NULL
    REFERENCES system_accounts(id) ON DELETE RESTRICT,
  family_id TEXT NOT NULL
    CHECK (length(family_id) BETWEEN 1 AND 255),
  token_hash TEXT NOT NULL
    CHECK (length(token_hash) BETWEEN 32 AND 512),
  token_version INTEGER NOT NULL
    CHECK (token_version >= 0),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
    CHECK (expires_at > created_at),
  rotated_at INTEGER
    CHECK (
      rotated_at IS NULL OR (
        rotated_at >= created_at AND rotated_at < expires_at
      )
    ),
  revoked_at INTEGER
    CHECK (
      revoked_at IS NULL OR (
        revoked_at >= created_at
        AND (rotated_at IS NULL OR revoked_at >= rotated_at)
      )
    )
, authenticated_at INTEGER
  CHECK (authenticated_at IS NULL OR authenticated_at <= created_at),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
--> statement-breakpoint

CREATE TABLE system_totp_credentials (
  account_id TEXT PRIMARY KEY NOT NULL
    REFERENCES system_accounts(id) ON DELETE CASCADE,
  secret_ciphertext TEXT NOT NULL
    CHECK (length(secret_ciphertext) BETWEEN 16 AND 512),
  status TEXT NOT NULL CHECK (status IN ('pending', 'active')),
  last_used_step INTEGER CHECK (last_used_step IS NULL OR last_used_step >= 0),
  recovery_code_hashes TEXT NOT NULL
    CHECK (length(recovery_code_hashes) BETWEEN 2 AND 2048),
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  updated_at INTEGER NOT NULL,
  enabled_at INTEGER,
  CHECK (updated_at >= created_at),
  CHECK (
    (status = 'pending' AND enabled_at IS NULL)
    OR (status = 'active' AND enabled_at IS NOT NULL AND enabled_at >= created_at)
  )
);
--> statement-breakpoint

CREATE TABLE system_totp_login_challenges (
  challenge_hash TEXT PRIMARY KEY NOT NULL
    CHECK (length(challenge_hash) = 64 AND challenge_hash NOT GLOB '*[^0-9a-f]*'),
  account_id TEXT NOT NULL
    REFERENCES system_accounts(id) ON DELETE CASCADE,
  token_version INTEGER NOT NULL CHECK (token_version >= 0),
  failed_attempts INTEGER NOT NULL CHECK (failed_attempts >= 0),
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  expires_at INTEGER NOT NULL,
  CHECK (expires_at > created_at)
);
--> statement-breakpoint

CREATE INDEX system_identity_bindings_account_idx
  ON system_identity_bindings (account_id);
--> statement-breakpoint

CREATE UNIQUE INDEX system_identity_bindings_provider_subject_uniq
  ON system_identity_bindings (provider, subject);
--> statement-breakpoint

DROP TRIGGER IF EXISTS system_identity_bindings_closed_account_guard;
--> statement-breakpoint

CREATE TRIGGER system_identity_bindings_closed_account_guard
BEFORE INSERT ON system_identity_bindings
WHEN EXISTS (
  SELECT 1 FROM system_accounts
  WHERE id = NEW.account_id AND closed_at IS NOT NULL
)
BEGIN
  SELECT RAISE(ABORT, 'closed account cannot receive an identity');
END;
--> statement-breakpoint

DROP TRIGGER IF EXISTS system_identity_bindings_immutable_identity;
--> statement-breakpoint

CREATE TRIGGER system_identity_bindings_immutable_identity
BEFORE UPDATE OF account_id, provider, subject, created_at ON system_identity_bindings
BEGIN
  SELECT RAISE(ABORT, 'identity binding identity is immutable');
END;
--> statement-breakpoint

DROP TRIGGER IF EXISTS system_identity_bindings_monotonic_lifecycle;
--> statement-breakpoint

CREATE TRIGGER system_identity_bindings_monotonic_lifecycle
BEFORE UPDATE ON system_identity_bindings
WHEN
  (OLD.activated_at IS NOT NULL AND NEW.activated_at IS NOT OLD.activated_at)
  OR (OLD.revoked_at IS NOT NULL AND NEW.revoked_at IS NOT OLD.revoked_at)
BEGIN
  SELECT RAISE(ABORT, 'identity lifecycle is not monotonic');
END;
--> statement-breakpoint

CREATE INDEX system_identity_profiles_email_idx
  ON system_identity_profiles (email);
--> statement-breakpoint

DROP TRIGGER IF EXISTS company_external_identity_sources_no_delete;
--> statement-breakpoint

CREATE TRIGGER company_external_identity_sources_no_delete
BEFORE DELETE ON company_external_identity_sources
BEGIN
  SELECT RAISE(ABORT, 'external identity source is immutable');
END;
--> statement-breakpoint

DROP TRIGGER IF EXISTS company_external_identity_sources_revision;
--> statement-breakpoint

CREATE TRIGGER company_external_identity_sources_revision
BEFORE UPDATE ON company_external_identity_sources
WHEN NEW.identity_id IS NOT OLD.identity_id
  OR NEW.organization_id IS NOT OLD.organization_id
  OR NEW.source_revision <= OLD.source_revision
  OR NEW.updated_at < OLD.updated_at
BEGIN
  SELECT RAISE(ABORT, 'external identity source revision conflict');
END;
--> statement-breakpoint

CREATE INDEX system_passkey_enrollments_account_idx
  ON system_passkey_enrollments (account_id, expires_at);
--> statement-breakpoint

DROP TRIGGER IF EXISTS system_passkey_enrollments_identity_guard;
--> statement-breakpoint

CREATE TRIGGER system_passkey_enrollments_identity_guard
BEFORE INSERT ON system_passkey_enrollments
WHEN NOT EXISTS (
  SELECT 1 FROM system_identity_bindings
  WHERE id = NEW.identity_id AND account_id = NEW.account_id
    AND provider = 'passkey' AND revoked_at IS NULL
)
BEGIN
  SELECT RAISE(ABORT, 'passkey enrollment requires an active passkey identity');
END;
--> statement-breakpoint

DROP TRIGGER IF EXISTS system_passkey_enrollments_monotonic_update;
--> statement-breakpoint

CREATE TRIGGER system_passkey_enrollments_monotonic_update
BEFORE UPDATE ON system_passkey_enrollments
WHEN NEW.id IS NOT OLD.id
  OR NEW.account_id IS NOT OLD.account_id
  OR NEW.identity_id IS NOT OLD.identity_id
  OR NEW.token_hash IS NOT OLD.token_hash
  OR NEW.reason IS NOT OLD.reason
  OR NEW.issued_by_account_id IS NOT OLD.issued_by_account_id
  OR NEW.created_at IS NOT OLD.created_at
  OR NEW.expires_at IS NOT OLD.expires_at
  OR (OLD.consumed_at IS NOT NULL AND NEW.consumed_at IS NOT OLD.consumed_at)
  OR (OLD.revoked_at IS NOT NULL AND NEW.revoked_at IS NOT OLD.revoked_at)
BEGIN
  SELECT RAISE(ABORT, 'passkey enrollment update is not monotonic');
END;
--> statement-breakpoint

DROP TRIGGER IF EXISTS system_passkey_enrollments_no_delete;
--> statement-breakpoint

CREATE TRIGGER system_passkey_enrollments_no_delete
BEFORE DELETE ON system_passkey_enrollments
BEGIN
  SELECT RAISE(ABORT, 'passkey enrollments are retained');
END;
--> statement-breakpoint

CREATE INDEX system_browser_login_codes_expires_idx
  ON system_browser_login_codes (expires_at);
--> statement-breakpoint

CREATE INDEX system_cli_login_codes_expires_idx
  ON system_cli_login_codes (expires_at);
--> statement-breakpoint

CREATE INDEX system_cli_login_states_expires_idx
  ON system_cli_login_states (expires_at);
--> statement-breakpoint

CREATE INDEX system_identity_login_tokens_expires_idx
  ON system_identity_login_tokens (expires_at);
--> statement-breakpoint

CREATE INDEX system_oidc_access_tokens_expires_idx
  ON system_oidc_access_tokens (expires_at);
--> statement-breakpoint

CREATE INDEX system_oidc_authorization_codes_expires_idx
  ON system_oidc_authorization_codes (expires_at);
--> statement-breakpoint

DROP TRIGGER IF EXISTS system_password_credentials_monotonic_change;
--> statement-breakpoint

CREATE TRIGGER system_password_credentials_monotonic_change
BEFORE UPDATE ON system_password_credentials
WHEN
  NEW.identity_id IS NOT OLD.identity_id
  OR NEW.created_at IS NOT OLD.created_at
  OR NEW.changed_at < OLD.changed_at
  OR NEW.updated_at < OLD.updated_at
BEGIN
  SELECT RAISE(ABORT, 'password credential change is not monotonic');
END;
--> statement-breakpoint

DROP TRIGGER IF EXISTS system_password_credentials_provider_insert;
--> statement-breakpoint

CREATE TRIGGER system_password_credentials_provider_insert
BEFORE INSERT ON system_password_credentials
WHEN NOT EXISTS (
  SELECT 1 FROM system_identity_bindings
  WHERE id = NEW.identity_id AND provider = 'password'
)
BEGIN
  SELECT RAISE(ABORT, 'password credential requires password identity');
END;
--> statement-breakpoint

DROP TRIGGER IF EXISTS system_password_credentials_provider_update;
--> statement-breakpoint

CREATE TRIGGER system_password_credentials_provider_update
BEFORE UPDATE OF identity_id ON system_password_credentials
WHEN NOT EXISTS (
  SELECT 1 FROM system_identity_bindings
  WHERE id = NEW.identity_id AND provider = 'password'
)
BEGIN
  SELECT RAISE(ABORT, 'password credential requires password identity');
END;
--> statement-breakpoint

CREATE INDEX system_password_reset_challenges_account_idx
  ON system_password_reset_challenges (account_id, created_at);
--> statement-breakpoint

CREATE INDEX system_password_reset_challenges_expires_idx
  ON system_password_reset_challenges (expires_at);
--> statement-breakpoint

CREATE UNIQUE INDEX system_password_reset_challenges_token_hash_uniq
  ON system_password_reset_challenges (token_hash);
--> statement-breakpoint

DROP TRIGGER IF EXISTS system_password_reset_challenges_monotonic_use;
--> statement-breakpoint

CREATE TRIGGER system_password_reset_challenges_monotonic_use
BEFORE UPDATE ON system_password_reset_challenges
WHEN
  NEW.id IS NOT OLD.id
  OR NEW.token_hash IS NOT OLD.token_hash
  OR NEW.account_id IS NOT OLD.account_id
  OR NEW.identity_id IS NOT OLD.identity_id
  OR NEW.created_at IS NOT OLD.created_at
  OR NEW.expires_at IS NOT OLD.expires_at
  OR (OLD.used_at IS NOT NULL AND NEW.used_at IS NOT OLD.used_at)
BEGIN
  SELECT RAISE(ABORT, 'password reset challenge lifecycle is not monotonic');
END;
--> statement-breakpoint

DROP TRIGGER IF EXISTS system_password_reset_challenges_password_identity_insert;
--> statement-breakpoint

CREATE TRIGGER system_password_reset_challenges_password_identity_insert
BEFORE INSERT ON system_password_reset_challenges
WHEN NOT EXISTS (
  SELECT 1 FROM system_identity_bindings
  WHERE id = NEW.identity_id
    AND account_id = NEW.account_id
    AND provider = 'password'
    AND revoked_at IS NULL
)
BEGIN
  SELECT RAISE(ABORT, 'password reset challenge requires a password identity');
END;
--> statement-breakpoint

CREATE INDEX system_sessions_account_idx
  ON system_sessions (account_id, created_at);
--> statement-breakpoint

CREATE INDEX system_sessions_active_family_idx
  ON system_sessions (family_id) WHERE revoked_at IS NULL;
--> statement-breakpoint

CREATE UNIQUE INDEX system_sessions_token_hash_uniq
  ON system_sessions (token_hash);
--> statement-breakpoint

DROP TRIGGER IF EXISTS system_sessions_closed_account_guard;
--> statement-breakpoint

CREATE TRIGGER system_sessions_closed_account_guard
BEFORE INSERT ON system_sessions
WHEN EXISTS (
  SELECT 1 FROM system_accounts
  WHERE id = NEW.account_id AND closed_at IS NOT NULL
)
BEGIN
  SELECT RAISE(ABORT, 'closed account cannot receive a session');
END;
--> statement-breakpoint

DROP TRIGGER IF EXISTS system_sessions_monotonic_lifecycle;
--> statement-breakpoint

CREATE TRIGGER system_sessions_monotonic_lifecycle
BEFORE UPDATE ON system_sessions
WHEN
  NEW.id IS NOT OLD.id
  OR NEW.account_id IS NOT OLD.account_id
  OR NEW.family_id IS NOT OLD.family_id
  OR NEW.token_hash IS NOT OLD.token_hash
  OR NEW.token_version IS NOT OLD.token_version
  OR NEW.created_at IS NOT OLD.created_at
  OR NEW.expires_at IS NOT OLD.expires_at
  OR (OLD.authenticated_at IS NOT NULL AND NEW.authenticated_at IS NOT OLD.authenticated_at)
  OR (OLD.rotated_at IS NOT NULL AND NEW.rotated_at IS NOT OLD.rotated_at)
  OR (OLD.revoked_at IS NOT NULL AND NEW.revoked_at IS NOT OLD.revoked_at)
BEGIN
  SELECT RAISE(ABORT, 'session lifecycle is not monotonic');
END;
--> statement-breakpoint

CREATE INDEX system_totp_login_challenges_account_idx
  ON system_totp_login_challenges (account_id);
--> statement-breakpoint

CREATE INDEX system_totp_login_challenges_expires_idx
  ON system_totp_login_challenges (expires_at);
--> statement-breakpoint

SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM pragma_foreign_key_check('system_identity_bindings')) THEN 1 ELSE json_extract('', '$') END AS foreign_keys_are_valid;
--> statement-breakpoint

SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM pragma_foreign_key_check('system_identity_profiles')) THEN 1 ELSE json_extract('', '$') END AS foreign_keys_are_valid;
--> statement-breakpoint

SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM pragma_foreign_key_check('company_external_identity_sources')) THEN 1 ELSE json_extract('', '$') END AS foreign_keys_are_valid;
--> statement-breakpoint

SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM pragma_foreign_key_check('system_passkey_enrollments')) THEN 1 ELSE json_extract('', '$') END AS foreign_keys_are_valid;
--> statement-breakpoint

DROP TABLE _auth_stage_system_identity_bindings;
--> statement-breakpoint

DROP TABLE _auth_stage_system_identity_profiles;
--> statement-breakpoint

DROP TABLE _auth_stage_company_external_identity_sources;
--> statement-breakpoint

DROP TABLE _auth_stage_system_passkey_enrollments;
