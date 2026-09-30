import type { SystemD1Context } from "@system/configuration/system-context"
import { createLocalD1Database } from "@system/test/local-d1/create-local-d1-database.test-support"
import { readFileSync } from "node:fs"

const integrationSchema = readFileSync(
  new URL("../infrastructure/schema/system-integration.sql", import.meta.url),
  "utf8",
)
const principalSchema = readFileSync(
  new URL("../infrastructure/schema/system-principal.sql", import.meta.url),
  "utf8",
)
const deliverySchema = readFileSync(
  new URL("../infrastructure/schema/system-delivery.sql", import.meta.url),
  "utf8",
)

const schema = `

  CREATE TABLE system_accounts (
    id TEXT PRIMARY KEY NOT NULL CHECK (length(id) BETWEEN 1 AND 255),
    legacy_id TEXT UNIQUE,
    status TEXT NOT NULL CHECK (status IN ('active', 'suspended', 'locked')),
    token_version INTEGER NOT NULL DEFAULT 0 CHECK (token_version >= 0),
    closed_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL CHECK (updated_at >= created_at),
    CHECK (closed_at IS NULL OR closed_at >= created_at)
  );

  CREATE TABLE system_identity_bindings (
    id TEXT PRIMARY KEY NOT NULL,
    account_id TEXT NOT NULL REFERENCES system_accounts(id) ON DELETE RESTRICT,
    provider TEXT NOT NULL,
    subject TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    activated_at INTEGER,
    revoked_at INTEGER
  );

  CREATE UNIQUE INDEX system_identity_bindings_provider_subject_uniq
    ON system_identity_bindings (provider, subject);

  CREATE TABLE system_identity_profiles (
    identity_id TEXT PRIMARY KEY NOT NULL
      REFERENCES system_identity_bindings(id) ON DELETE CASCADE,
    email TEXT,
    email_verified INTEGER NOT NULL DEFAULT 0,
    can_receive_email INTEGER NOT NULL DEFAULT 1,
    last_used_at INTEGER,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE system_password_credentials (
    identity_id TEXT PRIMARY KEY NOT NULL
      REFERENCES system_identity_bindings(id) ON DELETE CASCADE,
    password_hash TEXT NOT NULL,
    changed_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE system_authentication_attempts (
    id TEXT PRIMARY KEY NOT NULL,
    identifier TEXT NOT NULL,
    ip TEXT,
    attempted_at INTEGER NOT NULL
  );

  CREATE INDEX system_authentication_attempts_identifier_attempted_at_idx
    ON system_authentication_attempts (identifier, attempted_at);
  CREATE INDEX system_authentication_attempts_ip_attempted_at_idx
    ON system_authentication_attempts (ip, attempted_at);

  CREATE TABLE system_iam_roles (
    id TEXT PRIMARY KEY NOT NULL,
    legacy_id TEXT UNIQUE,
    key TEXT NOT NULL UNIQUE,
    kind TEXT NOT NULL,
    resource_type TEXT,
    name TEXT NOT NULL,
    description TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE system_iam_role_permissions (
    id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
    role_id TEXT NOT NULL,
    permission_key TEXT NOT NULL,
    UNIQUE (role_id, permission_key)
  );

  CREATE TABLE system_role_bindings (
    id TEXT PRIMARY KEY NOT NULL,
    legacy_id TEXT UNIQUE,
    account_id TEXT NOT NULL,
    role_id TEXT NOT NULL,
    resource_type TEXT,
    resource_id TEXT,
    created_at INTEGER NOT NULL,
    revoked_at INTEGER
  );

  CREATE TABLE system_bootstrap_state (
    singleton INTEGER PRIMARY KEY NOT NULL CHECK (singleton = 1),
    completed_by_account_id TEXT NOT NULL UNIQUE
      REFERENCES system_accounts(id) ON DELETE RESTRICT,
    root_binding_id TEXT NOT NULL UNIQUE
      REFERENCES system_role_bindings(id) ON DELETE RESTRICT,
    completed_at INTEGER NOT NULL
  );

  CREATE TABLE system_sessions (
    id TEXT PRIMARY KEY NOT NULL CHECK (length(id) BETWEEN 1 AND 255),
    account_id TEXT NOT NULL REFERENCES system_accounts(id) ON DELETE RESTRICT,
    family_id TEXT NOT NULL CHECK (length(family_id) BETWEEN 1 AND 255),
    token_hash TEXT NOT NULL CHECK (length(token_hash) BETWEEN 32 AND 512),
    token_version INTEGER NOT NULL CHECK (token_version >= 0),
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL CHECK (expires_at > created_at),
    rotated_at INTEGER CHECK (
      rotated_at IS NULL OR (rotated_at >= created_at AND rotated_at < expires_at)
    ),
    revoked_at INTEGER CHECK (
      revoked_at IS NULL OR (
        revoked_at >= created_at AND (rotated_at IS NULL OR revoked_at >= rotated_at)
      )
    ),
    authenticated_at INTEGER CHECK (authenticated_at IS NULL OR authenticated_at <= created_at)
  );

  CREATE UNIQUE INDEX system_sessions_token_hash_uniq ON system_sessions (token_hash);
  CREATE INDEX system_sessions_account_idx ON system_sessions (account_id, created_at);
  CREATE INDEX system_sessions_active_family_idx
    ON system_sessions (family_id) WHERE revoked_at IS NULL;

  CREATE TABLE system_identity_login_tokens (
    jti TEXT PRIMARY KEY NOT NULL,
    expires_at INTEGER NOT NULL,
    used_at INTEGER NOT NULL
  );

  CREATE INDEX system_identity_login_tokens_expires_idx
    ON system_identity_login_tokens (expires_at);

  CREATE TABLE system_cli_login_states (
    state TEXT PRIMARY KEY NOT NULL,
    port INTEGER NOT NULL,
    cli_state TEXT NOT NULL,
    code_verifier TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  );

  CREATE INDEX system_cli_login_states_expires_idx
    ON system_cli_login_states (expires_at);

  CREATE TABLE system_cli_login_codes (
    code_hash TEXT PRIMARY KEY NOT NULL,
    account_id TEXT NOT NULL REFERENCES system_accounts(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  );

  CREATE INDEX system_cli_login_codes_expires_idx
    ON system_cli_login_codes (expires_at);

  CREATE TABLE system_oidc_authorization_codes (
    code_hash TEXT PRIMARY KEY NOT NULL,
    issuer TEXT NOT NULL,
    client_id TEXT NOT NULL,
    redirect_uri TEXT NOT NULL,
    account_id TEXT NOT NULL REFERENCES system_accounts(id) ON DELETE CASCADE,
    code_challenge TEXT NOT NULL,
    nonce TEXT NOT NULL,
    scope TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE INDEX system_oidc_authorization_codes_expires_idx
    ON system_oidc_authorization_codes (expires_at);

  CREATE TABLE system_oidc_access_tokens (
    token_hash TEXT PRIMARY KEY NOT NULL,
    issuer TEXT NOT NULL,
    client_id TEXT NOT NULL,
    account_id TEXT NOT NULL REFERENCES system_accounts(id) ON DELETE CASCADE,
    scope TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE INDEX system_oidc_access_tokens_expires_idx
    ON system_oidc_access_tokens (expires_at);

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

  CREATE TABLE system_audit_events (
    event_id TEXT PRIMARY KEY NOT NULL CHECK (length(event_id) BETWEEN 1 AND 255),
    actor_account_id TEXT,
    action TEXT NOT NULL CHECK (length(action) BETWEEN 3 AND 200),
    target_type TEXT NOT NULL CHECK (length(target_type) BETWEEN 1 AND 200),
    target_id TEXT,
    outcome TEXT NOT NULL CHECK (outcome IN ('succeeded', 'denied', 'failed')),
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

  CREATE TRIGGER system_audit_events_prevent_update
  BEFORE UPDATE ON system_audit_events
  BEGIN
    SELECT RAISE(ABORT, 'system audit event is append-only');
  END;

  CREATE TRIGGER system_audit_events_prevent_delete
  BEFORE DELETE ON system_audit_events
  BEGIN
    SELECT RAISE(ABORT, 'system audit event is append-only');
  END;

  CREATE TABLE system_notification_messages (
    id TEXT PRIMARY KEY NOT NULL,
    kind TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT,
    source_type TEXT,
    source_id TEXT,
    action_type TEXT,
    action_id TEXT,
    priority TEXT NOT NULL DEFAULT 'normal',
    dedupe_key TEXT UNIQUE,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE system_notification_resource_scopes (
    message_id TEXT PRIMARY KEY NOT NULL REFERENCES system_notification_messages(id) ON DELETE CASCADE,
    resource_type TEXT NOT NULL,
    resource_id TEXT NOT NULL
  );

  CREATE TABLE system_notification_deliveries (
    id TEXT PRIMARY KEY NOT NULL,
    message_id TEXT NOT NULL REFERENCES system_notification_messages(id) ON DELETE RESTRICT,
    recipient_account_id TEXT NOT NULL REFERENCES system_accounts(id) ON DELETE RESTRICT,
    delivered_at INTEGER NOT NULL,
    read_at INTEGER,
    dismissed_at INTEGER
  );

  CREATE UNIQUE INDEX system_notification_deliveries_message_account_uniq
    ON system_notification_deliveries (message_id, recipient_account_id);

  CREATE TRIGGER system_notification_deliveries_monotonic_read
  BEFORE UPDATE ON system_notification_deliveries
  WHEN
    NEW.id IS NOT OLD.id
    OR NEW.message_id IS NOT OLD.message_id
    OR NEW.recipient_account_id IS NOT OLD.recipient_account_id
    OR NEW.delivered_at IS NOT OLD.delivered_at
    OR (OLD.read_at IS NOT NULL AND NEW.read_at IS NOT OLD.read_at)
  BEGIN
    SELECT RAISE(ABORT, 'notification delivery is immutable except first read');
  END;
`

/** canonical System SessionのD1 transactionをローカルD1で検証するtest context。 */
export class SystemSessionTestContext {
  private constructor(
    readonly database: D1Database,
    readonly context: SystemD1Context,
  ) {
    Object.freeze(this)
  }

  static async create(): Promise<SystemSessionTestContext> {
    const database = await createLocalD1Database({
      schema: [
        schema,
        readFileSync(
          new URL("../infrastructure/schema/system-audit-disclosure.sql", import.meta.url),
          "utf8",
        ),
        integrationSchema,
        principalSchema,
        deliverySchema,
      ].join("\n"),
    })
    return new SystemSessionTestContext(
      database,
      Object.freeze({ env: Object.freeze({ DB: database }) }),
    )
  }
}
