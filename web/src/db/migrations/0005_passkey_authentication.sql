-- void:allow-destructive
-- 認証をBetter Authのパスキーへ移す。
--
-- パスワード、System独自のセッション、CLIとブラウザのログインコード、外部IdPのログイン、OIDCの発行元の
-- tableを削除する。機械credentialの試行回数を数えるtableは残す。ログイン方法にpasskeyを足し、passwordのIdentityはpasskeyのIdentityへ移す。
-- 移したIdentityは未登録（activated_at が NULL）になり、パスキー招待で登録し直す。
-- 再認証の方式にpasskeyを足す。過去のgrantのpasswordとexternal_identityは履歴として残す。
--
-- Identityのtableを作り直すとき、DROP TABLE は子のtableへ外部キーの動作（CASCADE、RESTRICT）を起こす。
-- 子のtable（Identityのprofileと外部Identityの取込元）も退避して作り直し、外部キーは transaction の終わりに検査する。

PRAGMA defer_foreign_keys = true;
--> statement-breakpoint

DROP TABLE system_password_reset_challenges;
--> statement-breakpoint

DROP TABLE system_password_credentials;
--> statement-breakpoint

DROP TABLE system_identity_login_tokens;
--> statement-breakpoint

DROP TABLE system_cli_login_codes;
--> statement-breakpoint

DROP TABLE system_cli_login_states;
--> statement-breakpoint

DROP TABLE system_browser_login_codes;
--> statement-breakpoint

DROP TABLE system_oidc_access_tokens;
--> statement-breakpoint

DROP TABLE system_oidc_authorization_codes;
--> statement-breakpoint

DROP TABLE system_sessions;
--> statement-breakpoint

CREATE TABLE _stage_system_identity_bindings AS SELECT * FROM system_identity_bindings;
--> statement-breakpoint

CREATE TABLE _stage_system_identity_profiles AS SELECT * FROM system_identity_profiles;
--> statement-breakpoint

CREATE TABLE _stage_company_external_identity_sources AS SELECT * FROM company_external_identity_sources;
--> statement-breakpoint

CREATE TABLE _stage_system_step_up_grants AS SELECT * FROM system_step_up_grants;
--> statement-breakpoint

DROP TABLE company_external_identity_sources;
--> statement-breakpoint

DROP TABLE system_identity_profiles;
--> statement-breakpoint

DROP TABLE system_identity_bindings;
--> statement-breakpoint

DROP TABLE system_step_up_grants;
--> statement-breakpoint

CREATE TABLE system_identity_bindings (
  id TEXT PRIMARY KEY NOT NULL,
  account_id TEXT NOT NULL
    REFERENCES system_accounts(id) ON DELETE RESTRICT,
  provider TEXT NOT NULL
    CHECK (provider IN ('passkey', 'google', 'github', 'oidc')),
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

-- passwordのIdentityはpasskeyのIdentityへ移し、subjectはBetter AuthのユーザーIDとなるAccount IDにする。
-- 失効済みのIdentityは同じAccountで重ならないよう、subjectを自身のIDにする。
INSERT INTO system_identity_bindings
  (id, account_id, provider, subject, created_at, activated_at, revoked_at)
SELECT
  id,
  account_id,
  CASE WHEN provider = 'password' THEN 'passkey' ELSE provider END,
  CASE
    WHEN provider <> 'password' THEN subject
    WHEN revoked_at IS NULL THEN account_id
    ELSE id
  END,
  created_at,
  CASE WHEN provider = 'password' THEN NULL ELSE activated_at END,
  revoked_at
FROM _stage_system_identity_bindings;
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

INSERT INTO system_identity_profiles
  (identity_id, email, email_verified, last_used_at, updated_at, can_receive_email)
SELECT identity_id, email, email_verified, last_used_at, updated_at, can_receive_email
FROM _stage_system_identity_profiles;
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

INSERT INTO company_external_identity_sources
  (identity_id, organization_id, source_revision, source_digest, updated_at)
SELECT identity_id, organization_id, source_revision, source_digest, updated_at
FROM _stage_company_external_identity_sources;
--> statement-breakpoint

CREATE TABLE system_step_up_grants (
  id TEXT PRIMARY KEY NOT NULL,
  account_id TEXT NOT NULL REFERENCES system_accounts(id) ON DELETE RESTRICT,
  token_hash TEXT NOT NULL UNIQUE CHECK (
    length(token_hash) = 64 AND token_hash NOT GLOB '*[^0-9a-f]*'
  ),
  method TEXT NOT NULL CHECK (method IN ('passkey', 'password', 'external_identity')),
  issued_at INTEGER NOT NULL CHECK (issued_at >= 0),
  expires_at INTEGER NOT NULL CHECK (expires_at > issued_at),
  last_used_at INTEGER CHECK (
    last_used_at IS NULL OR (last_used_at >= issued_at AND last_used_at < expires_at)
  ),
  revoked_at INTEGER CHECK (
    revoked_at IS NULL OR (revoked_at >= issued_at AND revoked_at < expires_at)
  ),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
--> statement-breakpoint

INSERT INTO system_step_up_grants
  (id, account_id, token_hash, method, issued_at, expires_at, last_used_at, revoked_at)
SELECT id, account_id, token_hash, method, issued_at, expires_at, last_used_at, revoked_at
FROM _stage_system_step_up_grants;
--> statement-breakpoint

DROP TABLE _stage_system_identity_bindings;
--> statement-breakpoint

DROP TABLE _stage_system_identity_profiles;
--> statement-breakpoint

DROP TABLE _stage_company_external_identity_sources;
--> statement-breakpoint

DROP TABLE _stage_system_step_up_grants;
--> statement-breakpoint

CREATE INDEX system_identity_bindings_account_idx
  ON system_identity_bindings (account_id);
--> statement-breakpoint

CREATE UNIQUE INDEX system_identity_bindings_provider_subject_uniq
  ON system_identity_bindings (provider, subject);
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

CREATE TRIGGER system_identity_bindings_immutable_identity
BEFORE UPDATE OF account_id, provider, subject, created_at ON system_identity_bindings
BEGIN
  SELECT RAISE(ABORT, 'identity binding identity is immutable');
END;
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

CREATE TRIGGER company_external_identity_sources_no_delete
BEFORE DELETE ON company_external_identity_sources
BEGIN
  SELECT RAISE(ABORT, 'external identity source is immutable');
END;
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

CREATE INDEX system_step_up_grants_account_idx
  ON system_step_up_grants (account_id, expires_at);
--> statement-breakpoint

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
--> statement-breakpoint

CREATE TRIGGER system_step_up_grants_no_delete
BEFORE DELETE ON system_step_up_grants
BEGIN
  SELECT RAISE(ABORT, 'system_step_up_grants_are_retained');
END;
--> statement-breakpoint

-- パスキー招待。tokenはhashだけを残す。1つのAccountで使える招待は発行時に1件へ絞る。
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

CREATE INDEX system_passkey_enrollments_account_idx
  ON system_passkey_enrollments (account_id, expires_at);
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

CREATE TRIGGER system_passkey_enrollments_no_delete
BEFORE DELETE ON system_passkey_enrollments
BEGIN
  SELECT RAISE(ABORT, 'passkey enrollments are retained');
END;
--> statement-breakpoint

-- Better Authのtable。名前と列はBetter Authの既定に従い、Voidが実行時に作るものと同じにする。
CREATE TABLE IF NOT EXISTS "user" ("id" TEXT PRIMARY KEY NOT NULL, "name" TEXT NOT NULL, "email" TEXT NOT NULL, "emailVerified" INTEGER NOT NULL, "image" TEXT, "createdAt" INTEGER NOT NULL, "updatedAt" INTEGER NOT NULL);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "user_email_uidx" ON "user" ("email");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "session" ("id" TEXT PRIMARY KEY NOT NULL, "expiresAt" INTEGER NOT NULL, "token" TEXT NOT NULL, "createdAt" INTEGER NOT NULL, "updatedAt" INTEGER NOT NULL, "ipAddress" TEXT, "userAgent" TEXT, "userId" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE, "accountTokenVersion" INTEGER, "authenticationMethod" TEXT);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "session_token_uidx" ON "session" ("token");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "session_userId_idx" ON "session" ("userId");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "account" ("id" TEXT PRIMARY KEY NOT NULL, "accountId" TEXT NOT NULL, "providerId" TEXT NOT NULL, "userId" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE, "accessToken" TEXT, "refreshToken" TEXT, "idToken" TEXT, "accessTokenExpiresAt" INTEGER, "refreshTokenExpiresAt" INTEGER, "scope" TEXT, "password" TEXT, "createdAt" INTEGER NOT NULL, "updatedAt" INTEGER NOT NULL);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "account_userId_idx" ON "account" ("userId");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "verification" ("id" TEXT PRIMARY KEY NOT NULL, "identifier" TEXT NOT NULL, "value" TEXT NOT NULL, "expiresAt" INTEGER NOT NULL, "createdAt" INTEGER NOT NULL, "updatedAt" INTEGER NOT NULL);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "verification_identifier_idx" ON "verification" ("identifier");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "deviceCode" ("id" TEXT PRIMARY KEY NOT NULL, "deviceCode" TEXT NOT NULL, "userCode" TEXT NOT NULL, "userId" TEXT, "expiresAt" INTEGER NOT NULL, "status" TEXT NOT NULL, "lastPolledAt" INTEGER, "pollingInterval" INTEGER, "clientId" TEXT, "scope" TEXT);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "passkey" ("id" TEXT PRIMARY KEY NOT NULL, "name" TEXT, "publicKey" TEXT NOT NULL, "userId" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE, "credentialID" TEXT NOT NULL, "counter" INTEGER NOT NULL, "deviceType" TEXT NOT NULL, "backedUp" INTEGER NOT NULL, "transports" TEXT, "createdAt" INTEGER, "aaguid" TEXT);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "passkey_userId_idx" ON "passkey" ("userId");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "passkey_credentialID_idx" ON "passkey" ("credentialID");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "rateLimit" ("id" TEXT PRIMARY KEY NOT NULL, "key" TEXT NOT NULL, "count" INTEGER NOT NULL, "lastRequest" INTEGER NOT NULL);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "rateLimit_key_uidx" ON "rateLimit" ("key");
