-- 上位contextや製品runtimeから独立したcanonical System persistence。

CREATE TABLE system_accounts (
  id TEXT PRIMARY KEY NOT NULL,
  legacy_id TEXT UNIQUE,
  status TEXT NOT NULL
    CHECK (status IN ('active', 'suspended', 'locked')),
  token_version INTEGER NOT NULL DEFAULT 0
    CHECK (token_version >= 0),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
    CHECK (updated_at >= created_at)
, closed_at INTEGER
  CHECK (closed_at IS NULL OR closed_at >= created_at),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TRIGGER system_accounts_legacy_id_insert
BEFORE INSERT ON system_accounts
WHEN NEW.legacy_id IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'record_legacy_id_immutable'); END;
CREATE TRIGGER system_accounts_identity_update
BEFORE UPDATE OF id, legacy_id ON system_accounts
WHEN NEW.id IS NOT OLD.id OR NEW.legacy_id IS NOT OLD.legacy_id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

/* DDL-only test harnesses skip compound triggers. Full migration loaders apply this statement. */
CREATE TRIGGER system_accounts_monotonic_security_state
BEFORE UPDATE ON system_accounts
WHEN
  NEW.id IS NOT OLD.id
  OR NEW.created_at IS NOT OLD.created_at
  OR NEW.token_version < OLD.token_version
  OR NEW.updated_at < OLD.updated_at
  OR (
    NEW.status IS NOT OLD.status
    AND NEW.token_version IS NOT OLD.token_version + 1
  )
  OR (
    OLD.closed_at IS NULL
    AND NEW.closed_at IS NOT NULL
    AND (
      NEW.status IS NOT 'suspended'
      OR NEW.token_version IS NOT OLD.token_version + 1
      OR NEW.updated_at IS NOT NEW.closed_at
      OR NEW.closed_at < OLD.updated_at
    )
  )
  OR (
    OLD.closed_at IS NOT NULL
    AND (
      NEW.status IS NOT OLD.status
      OR NEW.token_version IS NOT OLD.token_version
      OR NEW.updated_at IS NOT OLD.updated_at
      OR NEW.closed_at IS NOT OLD.closed_at
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'account security state is not monotonic');
END;

CREATE TABLE system_identity_bindings (
  id TEXT PRIMARY KEY NOT NULL,
  account_id TEXT NOT NULL
    REFERENCES system_accounts(id) ON DELETE RESTRICT,
  provider TEXT NOT NULL
    CHECK (provider IN ('password', 'google', 'github', 'oidc')),
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

CREATE UNIQUE INDEX system_identity_bindings_provider_subject_uniq
  ON system_identity_bindings (provider, subject);
CREATE INDEX system_identity_bindings_account_idx
  ON system_identity_bindings (account_id);

/* DDL-only test harnesses skip compound triggers. Full migration loaders apply this statement. */
CREATE TRIGGER system_identity_bindings_immutable_identity
BEFORE UPDATE OF account_id, provider, subject, created_at ON system_identity_bindings
BEGIN
  SELECT RAISE(ABORT, 'identity binding identity is immutable');
END;

/* DDL-only test harnesses skip compound triggers. Full migration loaders apply this statement. */
CREATE TRIGGER system_identity_bindings_monotonic_lifecycle
BEFORE UPDATE ON system_identity_bindings
WHEN
  (OLD.activated_at IS NOT NULL AND NEW.activated_at IS NOT OLD.activated_at)
  OR (OLD.revoked_at IS NOT NULL AND NEW.revoked_at IS NOT OLD.revoked_at)
BEGIN
  SELECT RAISE(ABORT, 'identity lifecycle is not monotonic');
END;

/* DDL-only test harnesses skip compound triggers. Full migration loaders apply this statement. */
CREATE TRIGGER system_identity_bindings_closed_account_guard
BEFORE INSERT ON system_identity_bindings
WHEN EXISTS (
  SELECT 1 FROM system_accounts
  WHERE id = NEW.account_id AND closed_at IS NOT NULL
)
BEGIN
  SELECT RAISE(ABORT, 'closed account cannot receive an identity');
END;

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

CREATE INDEX system_identity_profiles_email_idx
  ON system_identity_profiles (email);


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

/* DDL-only test harnesses skip compound triggers. Full migration loaders apply this statement. */
CREATE TRIGGER system_password_credentials_provider_insert
BEFORE INSERT ON system_password_credentials
WHEN NOT EXISTS (
  SELECT 1 FROM system_identity_bindings
  WHERE id = NEW.identity_id AND provider = 'password'
)
BEGIN
  SELECT RAISE(ABORT, 'password credential requires password identity');
END;

/* DDL-only test harnesses skip compound triggers. Full migration loaders apply this statement. */
CREATE TRIGGER system_password_credentials_provider_update
BEFORE UPDATE OF identity_id ON system_password_credentials
WHEN NOT EXISTS (
  SELECT 1 FROM system_identity_bindings
  WHERE id = NEW.identity_id AND provider = 'password'
)
BEGIN
  SELECT RAISE(ABORT, 'password credential requires password identity');
END;

/* DDL-only test harnesses skip compound triggers. Full migration loaders apply this statement. */
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

CREATE UNIQUE INDEX system_password_reset_challenges_token_hash_uniq
  ON system_password_reset_challenges (token_hash);
CREATE INDEX system_password_reset_challenges_account_idx
  ON system_password_reset_challenges (account_id, created_at);
CREATE INDEX system_password_reset_challenges_expires_idx
  ON system_password_reset_challenges (expires_at);

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

CREATE TABLE system_authentication_attempts (
  id TEXT PRIMARY KEY NOT NULL,
  identifier TEXT NOT NULL
    CHECK (length(identifier) BETWEEN 1 AND 2048),
  ip TEXT
    CHECK (ip IS NULL OR length(ip) BETWEEN 1 AND 255),
  attempted_at INTEGER NOT NULL,
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);

CREATE INDEX system_authentication_attempts_identifier_attempted_at_idx
  ON system_authentication_attempts (identifier, attempted_at);
CREATE INDEX system_authentication_attempts_ip_attempted_at_idx
  ON system_authentication_attempts (ip, attempted_at);

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

CREATE UNIQUE INDEX system_sessions_token_hash_uniq
  ON system_sessions (token_hash);
CREATE INDEX system_sessions_account_idx
  ON system_sessions (account_id, created_at);
CREATE INDEX system_sessions_active_family_idx
  ON system_sessions (family_id) WHERE revoked_at IS NULL;

/* DDL-only test harnesses skip compound triggers. Full migration loaders apply this statement. */
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

/* DDL-only test harnesses skip compound triggers. Full migration loaders apply this statement. */
CREATE TRIGGER system_sessions_closed_account_guard
BEFORE INSERT ON system_sessions
WHEN EXISTS (
  SELECT 1 FROM system_accounts
  WHERE id = NEW.account_id AND closed_at IS NOT NULL
)
BEGIN
  SELECT RAISE(ABORT, 'closed account cannot receive a session');
END;

CREATE TABLE system_identity_login_tokens (
  jti TEXT PRIMARY KEY NOT NULL
    CHECK (length(jti) BETWEEN 1 AND 512),
  expires_at INTEGER NOT NULL,
  used_at INTEGER NOT NULL,
  CHECK (expires_at > used_at)
);

CREATE INDEX system_identity_login_tokens_expires_idx
  ON system_identity_login_tokens (expires_at);

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

CREATE INDEX system_cli_login_states_expires_idx
  ON system_cli_login_states (expires_at);

CREATE TABLE system_cli_login_codes (
  code_hash TEXT PRIMARY KEY NOT NULL
    CHECK (length(code_hash) BETWEEN 32 AND 512),
  account_id TEXT NOT NULL
    REFERENCES system_accounts(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  CHECK (expires_at > created_at)
);

CREATE INDEX system_cli_login_codes_expires_idx
  ON system_cli_login_codes (expires_at);

CREATE TABLE system_browser_login_codes (
  code_hash TEXT PRIMARY KEY NOT NULL
    CHECK (length(code_hash) BETWEEN 32 AND 512),
  account_id TEXT NOT NULL
    REFERENCES system_accounts(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  CHECK (expires_at > created_at)
);

CREATE INDEX system_browser_login_codes_expires_idx
  ON system_browser_login_codes (expires_at);

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

CREATE INDEX system_oidc_authorization_codes_expires_idx
  ON system_oidc_authorization_codes (expires_at);

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

CREATE INDEX system_oidc_access_tokens_expires_idx
  ON system_oidc_access_tokens (expires_at);

CREATE TABLE system_iam_roles (
  id TEXT PRIMARY KEY NOT NULL,
  legacy_id TEXT UNIQUE,
  key TEXT NOT NULL
    CHECK (length(key) BETWEEN 3 AND 100),
  kind TEXT NOT NULL
    CHECK (kind IN ('managed', 'custom')),
  name TEXT NOT NULL
    CHECK (length(name) BETWEEN 1 AND 100),
  description TEXT
    CHECK (description IS NULL OR length(description) BETWEEN 1 AND 1000),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
    CHECK (updated_at >= created_at)
, resource_type TEXT
  CHECK (resource_type IS NULL OR length(resource_type) BETWEEN 3 AND 100),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);

CREATE TRIGGER system_iam_roles_legacy_id_insert
BEFORE INSERT ON system_iam_roles
WHEN NEW.legacy_id IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'record_legacy_id_immutable'); END;

CREATE TRIGGER system_iam_roles_identity_update
BEFORE UPDATE OF id, legacy_id ON system_iam_roles
WHEN NEW.id IS NOT OLD.id OR NEW.legacy_id IS NOT OLD.legacy_id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

CREATE UNIQUE INDEX system_iam_roles_key_uniq
  ON system_iam_roles (key);

CREATE TABLE system_iam_role_permissions (
  -- 旧来の主キーで行を足す書込みが残るため、主キーは列の既定値でも採番する。
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  role_id TEXT NOT NULL
    REFERENCES system_iam_roles(id) ON DELETE CASCADE,
  permission_key TEXT NOT NULL
    CHECK (length(permission_key) BETWEEN 3 AND 100),
  UNIQUE (role_id, permission_key),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
) WITHOUT ROWID;

CREATE TRIGGER system_iam_role_permissions_identity_update
BEFORE UPDATE OF id ON system_iam_role_permissions
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

/* DDL-only test harnesses skip compound triggers. Full migration loaders apply this statement. */
CREATE TRIGGER system_iam_roles_immutable_identity
BEFORE UPDATE OF id, key, kind, resource_type, created_at ON system_iam_roles
BEGIN
  SELECT RAISE(ABORT, 'IAM role identity is immutable');
END;

CREATE TABLE system_role_bindings (
  id TEXT PRIMARY KEY NOT NULL,
  legacy_id TEXT UNIQUE,
  account_id TEXT NOT NULL
    REFERENCES system_accounts(id) ON DELETE RESTRICT,
  role_id TEXT NOT NULL
    REFERENCES system_iam_roles(id) ON DELETE RESTRICT,
  resource_type TEXT,
  resource_id TEXT,
  created_at INTEGER NOT NULL,
  revoked_at INTEGER
    CHECK (revoked_at IS NULL OR revoked_at >= created_at),
  CHECK (
    (resource_type IS NULL AND resource_id IS NULL) OR (
      resource_type IS NOT NULL AND resource_id IS NOT NULL
      AND length(resource_type) BETWEEN 3 AND 100
      AND length(resource_id) BETWEEN 1 AND 255
    )
  ),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);

CREATE TRIGGER system_role_bindings_legacy_id_insert
BEFORE INSERT ON system_role_bindings
WHEN NEW.legacy_id IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'record_legacy_id_immutable'); END;

CREATE TRIGGER system_role_bindings_identity_update
BEFORE UPDATE OF id, legacy_id ON system_role_bindings
WHEN NEW.id IS NOT OLD.id OR NEW.legacy_id IS NOT OLD.legacy_id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

CREATE UNIQUE INDEX system_role_bindings_active_uniq
  ON system_role_bindings (
    account_id,
    role_id,
    coalesce(resource_type, ''),
    coalesce(resource_id, '')
  )
  WHERE revoked_at IS NULL;
CREATE INDEX system_role_bindings_account_idx
  ON system_role_bindings (account_id, created_at);
CREATE INDEX system_role_bindings_role_idx
  ON system_role_bindings (role_id, created_at);
CREATE INDEX system_role_bindings_resource_idx
  ON system_role_bindings (resource_type, resource_id);

/* DDL-only test harnesses skip compound triggers. Full migration loaders apply this statement. */
CREATE TRIGGER system_role_bindings_monotonic_lifecycle
BEFORE UPDATE ON system_role_bindings
WHEN
  NEW.id IS NOT OLD.id
  OR NEW.account_id IS NOT OLD.account_id
  OR NEW.role_id IS NOT OLD.role_id
  OR NEW.resource_type IS NOT OLD.resource_type
  OR NEW.resource_id IS NOT OLD.resource_id
  OR NEW.created_at IS NOT OLD.created_at
  OR (OLD.revoked_at IS NOT NULL AND NEW.revoked_at IS NOT OLD.revoked_at)
BEGIN
  SELECT RAISE(ABORT, 'role binding lifecycle is not monotonic');
END;

/* DDL-only test harnesses skip compound triggers. Full migration loaders apply this statement. */
CREATE TRIGGER system_role_bindings_closed_account_guard
BEFORE INSERT ON system_role_bindings
WHEN EXISTS (
  SELECT 1 FROM system_accounts
  WHERE id = NEW.account_id AND closed_at IS NOT NULL
)
BEGIN
  SELECT RAISE(ABORT, 'closed account cannot receive a role binding');
END;

CREATE TABLE system_account_invitations (
  id TEXT PRIMARY KEY NOT NULL,
  token TEXT NOT NULL,
  subject TEXT,
  role_id TEXT NOT NULL
    REFERENCES system_iam_roles(id) ON DELETE RESTRICT,
  accepted_by_account_id TEXT
    REFERENCES system_accounts(id) ON DELETE RESTRICT,
  expires_at INTEGER NOT NULL,
  revoked_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL, resource_type TEXT, resource_id TEXT
  CHECK ((resource_type IS NULL AND resource_id IS NULL) OR (
    resource_type IS NOT NULL AND resource_id IS NOT NULL
    AND length(resource_type) BETWEEN 3 AND 100
    AND length(resource_id) BETWEEN 1 AND 255
  )), related_resource_id TEXT
  CHECK (related_resource_id IS NULL OR (
    resource_type IS NOT NULL AND resource_id IS NOT NULL
    AND length(related_resource_id) BETWEEN 1 AND 255
  )),
  CHECK (
    updated_at >= created_at
    AND expires_at >= created_at
    AND (revoked_at IS NULL OR revoked_at >= created_at)
  ),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);

CREATE UNIQUE INDEX system_account_invitations_token_uniq
  ON system_account_invitations (token);
CREATE INDEX system_account_invitations_role_idx
  ON system_account_invitations (role_id, created_at);
CREATE INDEX system_account_invitations_subject_idx
  ON system_account_invitations (subject, created_at);
CREATE INDEX system_account_invitations_resource_idx
  ON system_account_invitations (resource_type, resource_id);

CREATE TABLE system_notification_messages (
  id TEXT PRIMARY KEY NOT NULL
    CHECK (length(id) BETWEEN 1 AND 255),
  kind TEXT NOT NULL
    CHECK (length(kind) BETWEEN 3 AND 100),
  title TEXT NOT NULL
    CHECK (length(title) BETWEEN 1 AND 200),
  body TEXT
    CHECK (body IS NULL OR length(body) BETWEEN 1 AND 10000),
  action_url TEXT
    CHECK (action_url IS NULL OR length(action_url) BETWEEN 1 AND 2048),
  action_type TEXT,
  action_id TEXT,
  priority TEXT NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high', 'critical')),
  dedupe_key TEXT,
  source_type TEXT,
  source_id TEXT,
  created_at INTEGER NOT NULL,
  CHECK (
    (source_type IS NULL AND source_id IS NULL) OR (
      source_type IS NOT NULL AND source_id IS NOT NULL
      AND length(source_type) BETWEEN 3 AND 100
      AND length(source_id) BETWEEN 1 AND 512
    )
  ),
  CHECK (
    (action_type IS NULL AND action_id IS NULL) OR (
      action_type IS NOT NULL AND action_id IS NOT NULL
      AND length(action_type) BETWEEN 3 AND 100
      AND length(action_id) BETWEEN 1 AND 512
    )
  )
);

CREATE INDEX system_notification_messages_source_idx
  ON system_notification_messages (source_type, source_id);
CREATE INDEX system_notification_messages_priority_idx
  ON system_notification_messages (priority, created_at);
CREATE UNIQUE INDEX system_notification_messages_dedupe_key_uniq
  ON system_notification_messages (dedupe_key);

/* DDL-only test harnesses skip compound triggers. Full migration loaders apply this statement. */
CREATE TRIGGER system_notification_messages_prevent_update
BEFORE UPDATE ON system_notification_messages
BEGIN
  SELECT RAISE(ABORT, 'notification message is immutable');
END;

/* DDL-only test harnesses skip compound triggers. Full migration loaders apply this statement. */
CREATE TRIGGER system_notification_messages_prevent_delete
BEFORE DELETE ON system_notification_messages
BEGIN
  SELECT RAISE(ABORT, 'notification message is immutable');
END;

CREATE TABLE system_notification_resource_scopes (
  message_id TEXT PRIMARY KEY NOT NULL
    REFERENCES system_notification_messages(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL
    CHECK (length(resource_type) BETWEEN 3 AND 100),
  resource_id TEXT NOT NULL
    CHECK (length(resource_id) BETWEEN 1 AND 512)
);

CREATE INDEX system_notification_resource_scopes_resource_idx
  ON system_notification_resource_scopes (resource_type, resource_id, message_id);

CREATE TABLE system_notification_deliveries (
  id TEXT PRIMARY KEY NOT NULL
    CHECK (length(id) BETWEEN 1 AND 255),
  message_id TEXT NOT NULL
    REFERENCES system_notification_messages(id) ON DELETE RESTRICT,
  recipient_account_id TEXT NOT NULL
    REFERENCES system_accounts(id) ON DELETE RESTRICT,
  delivered_at INTEGER NOT NULL,
  read_at INTEGER
    CHECK (read_at IS NULL OR read_at >= delivered_at),
  dismissed_at INTEGER
    CHECK (dismissed_at IS NULL OR dismissed_at >= delivered_at)
);

CREATE UNIQUE INDEX system_notification_deliveries_message_account_uniq
  ON system_notification_deliveries (message_id, recipient_account_id);
CREATE INDEX system_notification_deliveries_account_idx
  ON system_notification_deliveries (recipient_account_id, delivered_at);
CREATE INDEX system_notification_deliveries_unread_idx
  ON system_notification_deliveries (recipient_account_id, delivered_at)
  WHERE read_at IS NULL AND dismissed_at IS NULL;

/* DDL-only test harnesses skip compound triggers. Full migration loaders apply this statement. */
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
  CHECK (finished_at IS NULL OR started_at IS NULL OR finished_at >= started_at)
);

CREATE INDEX system_batch_jobs_status_idx
  ON system_batch_jobs (status, id);


CREATE TABLE system_audit_events (
  event_id TEXT PRIMARY KEY NOT NULL
    CHECK (length(event_id) = 36 AND event_id NOT GLOB '*[^0-9a-f-]*' AND substr(event_id, 9, 1) = '-' AND substr(event_id, 14, 1) = '-' AND substr(event_id, 19, 1) = '-' AND substr(event_id, 24, 1) = '-' AND length(replace(event_id, '-', '')) = 32 AND substr(event_id, 15, 1) GLOB '[1-8]' AND substr(event_id, 20, 1) GLOB '[89ab]'),
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
  CHECK (metadata_json IS NULL OR json_valid(metadata_json))
);

CREATE INDEX system_audit_events_actor_idx
  ON system_audit_events (actor_account_id, occurred_at);
CREATE INDEX system_audit_events_action_idx
  ON system_audit_events (action, occurred_at);
CREATE INDEX system_audit_events_target_idx
  ON system_audit_events (target_type, target_id, occurred_at);
CREATE INDEX system_audit_events_outcome_idx
  ON system_audit_events (outcome, occurred_at);

/* DDL-only test harnesses skip compound triggers. Full migration loaders apply this statement. */
CREATE TRIGGER system_audit_events_prevent_update
BEFORE UPDATE ON system_audit_events
BEGIN
  SELECT RAISE(ABORT, 'system audit event is append-only');
END;

/* DDL-only test harnesses skip compound triggers. Full migration loaders apply this statement. */
CREATE TRIGGER system_audit_events_prevent_delete
BEFORE DELETE ON system_audit_events
BEGIN
  SELECT RAISE(ABORT, 'system audit event is append-only');
END;

CREATE TABLE system_bootstrap_state (
  singleton INTEGER PRIMARY KEY NOT NULL
    CHECK (singleton = 1),
  completed_by_account_id TEXT NOT NULL UNIQUE
    REFERENCES system_accounts(id) ON DELETE RESTRICT,
  root_binding_id TEXT NOT NULL UNIQUE
    REFERENCES system_role_bindings(id) ON DELETE RESTRICT,
  completed_at INTEGER NOT NULL
);

/* DDL-only test harnesses skip compound triggers. Full migration loaders apply this statement. */
CREATE TRIGGER system_bootstrap_state_validate_root
BEFORE INSERT ON system_bootstrap_state
WHEN NOT EXISTS (
  SELECT 1
  FROM system_role_bindings binding
  INNER JOIN system_accounts account
    ON account.id = binding.account_id
  INNER JOIN system_iam_role_permissions permission
    ON permission.role_id = binding.role_id
  WHERE binding.id = NEW.root_binding_id
    AND binding.account_id = NEW.completed_by_account_id
    AND binding.resource_type IS NULL
    AND binding.resource_id IS NULL
    AND binding.revoked_at IS NULL
    AND account.status = 'active'
    AND permission.permission_key = 'system:admin'
)
BEGIN
  SELECT RAISE(ABORT, 'bootstrap requires an active global System root binding');
END;

/* DDL-only test harnesses skip compound triggers. Full migration loaders apply this statement. */
CREATE TRIGGER system_bootstrap_state_prevent_update
BEFORE UPDATE ON system_bootstrap_state
BEGIN
  SELECT RAISE(ABORT, 'bootstrap state is immutable');
END;

/* DDL-only test harnesses skip compound triggers. Full migration loaders apply this statement. */
CREATE TRIGGER system_bootstrap_state_prevent_delete
BEFORE DELETE ON system_bootstrap_state
BEGIN
  SELECT RAISE(ABORT, 'bootstrap state is immutable');
END;

CREATE TABLE system_audit_disclosure_policy_revisions (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]'),
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
  CHECK (expires_at IS NULL OR expires_at > recorded_at)
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
