import type { AccountStatus } from "@system/domain/schemas/iam/account-status.schema"
import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import type { IdentityProvider } from "@system/domain/schemas/identity/identity-provider.schema"
import type { SystemAuditOutcome } from "@system/domain/entities/system-audit-event.entity"
import type { SystemBatchJobStatus } from "@system/domain/schemas/batch/system-batch-job-status.schema"
import type { SystemAuditDisclosurePolicyEntity } from "@system/domain/entities/system-audit-disclosure-policy.entity"
import { sql } from "drizzle-orm"
import type { InferSelectModel } from "drizzle-orm"
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
  unique,
  uniqueIndex,
} from "drizzle-orm/sqlite-core"

/** 上位contextを知らない、portableなSystem AccountEntity永続化契約。 */
export const systemAccounts = sqliteTable(
  "system_accounts",
  {
    id: text("id").primaryKey().$type<AccountId>(),
    /** 主キーを UUID へ移す前の値。移行前の記録を現在の行へ辿るために残す。 */
    legacyId: text("legacy_id").unique(),
    status: text("status").notNull().$type<AccountStatus>(),
    tokenVersion: integer("token_version").notNull().default(0),
    closedAt: integer("closed_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    check("system_accounts_id_length", sql`length(${table.id}) BETWEEN 1 AND 255`),
    check("system_accounts_status", sql`${table.status} IN ('active', 'suspended', 'locked')`),
    check("system_accounts_token_version", sql`${table.tokenVersion} >= 0`),
    check(
      "system_accounts_closed_chronology",
      sql`${table.closedAt} IS NULL OR ${table.closedAt} >= ${table.createdAt}`,
    ),
    check("system_accounts_chronology", sql`${table.updatedAt} >= ${table.createdAt}`),
  ],
)

export type SystemAccountRow = InferSelectModel<typeof systemAccounts>

/** AccountEntityとprovider subjectのbinding。credential/contact projectionは別tableが所有する。 */
export const systemIdentityBindings = sqliteTable(
  "system_identity_bindings",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => systemAccounts.id, { onDelete: "restrict" }),
    provider: text("provider").notNull().$type<IdentityProvider>(),
    subject: text("subject").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    activatedAt: integer("activated_at", { mode: "timestamp_ms" }),
    revokedAt: integer("revoked_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    uniqueIndex("system_identity_bindings_provider_subject_uniq").on(table.provider, table.subject),
    index("system_identity_bindings_account_idx").on(table.accountId),
    check("system_identity_bindings_id_length", sql`length(${table.id}) BETWEEN 1 AND 255`),
    check(
      "system_identity_bindings_provider",
      sql`${table.provider} IN ('password', 'google', 'github', 'oidc')`,
    ),
    check(
      "system_identity_bindings_subject_length",
      sql`length(${table.subject}) BETWEEN 1 AND 2048`,
    ),
    check(
      "system_identity_bindings_activation_chronology",
      sql`${table.activatedAt} IS NULL OR ${table.activatedAt} >= ${table.createdAt}`,
    ),
    check(
      "system_identity_bindings_revocation_chronology",
      sql`${table.revokedAt} IS NULL OR (
        ${table.revokedAt} >= ${table.createdAt}
        AND (${table.activatedAt} IS NULL OR ${table.revokedAt} >= ${table.activatedAt})
      )`,
    ),
  ],
)

export type SystemIdentityBindingRow = InferSelectModel<typeof systemIdentityBindings>

/** providerが返す連絡先claim。Identityの同一性とcredentialから分離して更新できる。 */
export const systemIdentityProfiles = sqliteTable(
  "system_identity_profiles",
  {
    identityId: text("identity_id")
      .primaryKey()
      .references(() => systemIdentityBindings.id, { onDelete: "cascade" }),
    email: text("email"),
    emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
    canReceiveEmail: integer("can_receive_email", { mode: "boolean" }).notNull().default(true),
    lastUsedAt: integer("last_used_at", { mode: "timestamp_ms" }),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("system_identity_profiles_email_idx").on(table.email),
    check(
      "system_identity_profiles_email_length",
      sql`${table.email} IS NULL OR length(${table.email}) BETWEEN 3 AND 320`,
    ),
  ],
)

export type SystemIdentityProfileRow = InferSelectModel<typeof systemIdentityProfiles>

/** password provider固有のsecret projection。encoded hashだけを保存する。 */
export const systemPasswordCredentials = sqliteTable(
  "system_password_credentials",
  {
    identityId: text("identity_id")
      .primaryKey()
      .references(() => systemIdentityBindings.id, { onDelete: "cascade" }),
    passwordHash: text("password_hash").notNull(),
    changedAt: integer("changed_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    check(
      "system_password_credentials_hash_length",
      sql`length(${table.passwordHash}) BETWEEN 20 AND 4096`,
    ),
    check(
      "system_password_credentials_chronology",
      sql`${table.changedAt} >= ${table.createdAt} AND ${table.updatedAt} >= ${table.changedAt}`,
    ),
  ],
)

export type SystemPasswordCredentialRow = InferSelectModel<typeof systemPasswordCredentials>

/** raw tokenを保存しない、単回利用のpassword reset challenge。 */
export const systemPasswordResetChallenges = sqliteTable(
  "system_password_reset_challenges",
  {
    id: text("id").primaryKey(),
    tokenHash: text("token_hash").notNull(),
    accountId: text("account_id")
      .notNull()
      .references(() => systemAccounts.id, { onDelete: "restrict" }),
    identityId: text("identity_id")
      .notNull()
      .references(() => systemIdentityBindings.id, { onDelete: "restrict" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    usedAt: integer("used_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    uniqueIndex("system_password_reset_challenges_token_hash_uniq").on(table.tokenHash),
    index("system_password_reset_challenges_account_idx").on(table.accountId, table.createdAt),
    index("system_password_reset_challenges_expires_idx").on(table.expiresAt),
    check("system_password_reset_challenges_id_length", sql`length(${table.id}) BETWEEN 1 AND 255`),
    check(
      "system_password_reset_challenges_hash",
      sql`length(${table.tokenHash}) = 64 AND ${table.tokenHash} NOT GLOB '*[^0-9a-f]*'`,
    ),
    check(
      "system_password_reset_challenges_expiration",
      sql`${table.expiresAt} > ${table.createdAt}`,
    ),
    check(
      "system_password_reset_challenges_use_chronology",
      sql`${table.usedAt} IS NULL OR ${table.usedAt} >= ${table.createdAt}`,
    ),
  ],
)

export type SystemPasswordResetChallengeRow = InferSelectModel<typeof systemPasswordResetChallenges>

/** 全isolateが共有する認証試行。認証前の資源なのでAccountEntityへのFKを持たない。 */
export const systemAuthenticationAttempts = sqliteTable(
  "system_authentication_attempts",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    ip: text("ip"),
    attemptedAt: integer("attempted_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("system_authentication_attempts_identifier_attempted_at_idx").on(
      table.identifier,
      table.attemptedAt,
    ),
    index("system_authentication_attempts_ip_attempted_at_idx").on(table.ip, table.attemptedAt),
    check("system_authentication_attempts_id_length", sql`length(${table.id}) BETWEEN 1 AND 255`),
    check(
      "system_authentication_attempts_identifier_length",
      sql`length(${table.identifier}) BETWEEN 1 AND 2048`,
    ),
    check(
      "system_authentication_attempts_ip_length",
      sql`${table.ip} IS NULL OR length(${table.ip}) BETWEEN 1 AND 255`,
    ),
  ],
)

export type SystemAuthenticationAttemptRow = InferSelectModel<typeof systemAuthenticationAttempts>

/** raw tokenを持たず、rotation/reuse detectionに必要なhashとfamilyだけを保持する。 */
export const systemSessions = sqliteTable(
  "system_sessions",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => systemAccounts.id, { onDelete: "restrict" }),
    familyId: text("family_id").notNull(),
    tokenHash: text("token_hash").notNull(),
    tokenVersion: integer("token_version").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    rotatedAt: integer("rotated_at", { mode: "timestamp_ms" }),
    revokedAt: integer("revoked_at", { mode: "timestamp_ms" }),
    authenticatedAt: integer("authenticated_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    uniqueIndex("system_sessions_token_hash_uniq").on(table.tokenHash),
    index("system_sessions_account_idx").on(table.accountId, table.createdAt),
    index("system_sessions_active_family_idx")
      .on(table.familyId)
      .where(sql`${table.revokedAt} IS NULL`),
    check("system_sessions_id_length", sql`length(${table.id}) BETWEEN 1 AND 255`),
    check("system_sessions_family_id_length", sql`length(${table.familyId}) BETWEEN 1 AND 255`),
    check("system_sessions_hash_length", sql`length(${table.tokenHash}) BETWEEN 32 AND 512`),
    check("system_sessions_token_version", sql`${table.tokenVersion} >= 0`),
    check("system_sessions_expiration", sql`${table.expiresAt} > ${table.createdAt}`),
    check(
      "system_sessions_rotation_chronology",
      sql`${table.rotatedAt} IS NULL OR (
        ${table.rotatedAt} >= ${table.createdAt} AND ${table.rotatedAt} < ${table.expiresAt}
      )`,
    ),
    check(
      "system_sessions_revocation_chronology",
      sql`${table.revokedAt} IS NULL OR (
        ${table.revokedAt} >= ${table.createdAt}
        AND (${table.rotatedAt} IS NULL OR ${table.revokedAt} >= ${table.rotatedAt})
      )`,
    ),
    check(
      "system_sessions_authentication_chronology",
      sql`${table.authenticatedAt} IS NULL OR ${table.authenticatedAt} <= ${table.createdAt}`,
    ),
  ],
)

export type SystemSessionRow = InferSelectModel<typeof systemSessions>

/** 外部Identity tokenのsingle-use jti。replay検知に必要な最小情報だけを保持する。 */
export const systemIdentityLoginTokens = sqliteTable(
  "system_identity_login_tokens",
  {
    jti: text("jti").primaryKey(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    usedAt: integer("used_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("system_identity_login_tokens_expires_idx").on(table.expiresAt),
    check("system_identity_login_tokens_jti_length", sql`length(${table.jti}) BETWEEN 1 AND 512`),
    check("system_identity_login_tokens_expiration", sql`${table.expiresAt} > ${table.usedAt}`),
  ],
)

export type SystemIdentityLoginTokenRow = InferSelectModel<typeof systemIdentityLoginTokens>

/** CLI login開始時のsingle-use state。brokerへCLI callback情報を直接露出しない。 */
export const systemCliLoginStates = sqliteTable(
  "system_cli_login_states",
  {
    state: text("state").primaryKey(),
    port: integer("port").notNull(),
    cliState: text("cli_state").notNull(),
    codeVerifier: text("code_verifier").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("system_cli_login_states_expires_idx").on(table.expiresAt),
    check("system_cli_login_states_state_length", sql`length(${table.state}) BETWEEN 16 AND 512`),
    check("system_cli_login_states_port", sql`${table.port} BETWEEN 1 AND 65535`),
    check(
      "system_cli_login_states_cli_state_length",
      sql`length(${table.cliState}) BETWEEN 1 AND 512`,
    ),
    check(
      "system_cli_login_states_verifier_length",
      sql`length(${table.codeVerifier}) BETWEEN 43 AND 128`,
    ),
    check("system_cli_login_states_expiration", sql`${table.expiresAt} > ${table.createdAt}`),
  ],
)

export type SystemCliLoginStateRow = InferSelectModel<typeof systemCliLoginStates>

/** CLI callbackからtoken交換へAccountEntityだけを渡すhashed single-use code。 */
export const systemCliLoginCodes = sqliteTable(
  "system_cli_login_codes",
  {
    codeHash: text("code_hash").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => systemAccounts.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("system_cli_login_codes_expires_idx").on(table.expiresAt),
    check("system_cli_login_codes_hash_length", sql`length(${table.codeHash}) BETWEEN 32 AND 512`),
    check("system_cli_login_codes_expiration", sql`${table.expiresAt} > ${table.createdAt}`),
  ],
)

export type SystemCliLoginCodeRow = InferSelectModel<typeof systemCliLoginCodes>

/** Web browserからtoken交換へAccountEntityだけを渡すhashed single-use code。 */
export const systemBrowserLoginCodes = sqliteTable(
  "system_browser_login_codes",
  {
    codeHash: text("code_hash").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => systemAccounts.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("system_browser_login_codes_expires_idx").on(table.expiresAt),
    check(
      "system_browser_login_codes_hash_length",
      sql`length(${table.codeHash}) BETWEEN 32 AND 512`,
    ),
    check("system_browser_login_codes_expiration", sql`${table.expiresAt} > ${table.createdAt}`),
  ],
)

export type SystemBrowserLoginCodeRow = InferSelectModel<typeof systemBrowserLoginCodes>

/** raw codeを保存せず、PKCE条件で一度だけ消費するOIDC authorization code。 */
export const systemOidcAuthorizationCodes = sqliteTable(
  "system_oidc_authorization_codes",
  {
    codeHash: text("code_hash").primaryKey(),
    issuer: text("issuer").notNull(),
    clientId: text("client_id").notNull(),
    redirectUri: text("redirect_uri").notNull(),
    accountId: text("account_id")
      .notNull()
      .$type<AccountId>()
      .references(() => systemAccounts.id, { onDelete: "cascade" }),
    codeChallenge: text("code_challenge").notNull(),
    nonce: text("nonce").notNull(),
    scope: text("scope").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("system_oidc_authorization_codes_expires_idx").on(table.expiresAt),
    check(
      "system_oidc_authorization_codes_hash_length",
      sql`length(${table.codeHash}) = 64 AND ${table.codeHash} NOT GLOB '*[^0-9a-f]*'`,
    ),
    check(
      "system_oidc_authorization_codes_expiration",
      sql`${table.expiresAt} > ${table.createdAt}`,
    ),
  ],
)

export type SystemOidcAuthorizationCodeRow = InferSelectModel<typeof systemOidcAuthorizationCodes>

/** raw tokenを保存しない、短命なOIDC UserInfo access token。 */
export const systemOidcAccessTokens = sqliteTable(
  "system_oidc_access_tokens",
  {
    tokenHash: text("token_hash").primaryKey(),
    issuer: text("issuer").notNull(),
    clientId: text("client_id").notNull(),
    accountId: text("account_id")
      .notNull()
      .$type<AccountId>()
      .references(() => systemAccounts.id, { onDelete: "cascade" }),
    scope: text("scope").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("system_oidc_access_tokens_expires_idx").on(table.expiresAt),
    check(
      "system_oidc_access_tokens_hash_length",
      sql`length(${table.tokenHash}) = 64 AND ${table.tokenHash} NOT GLOB '*[^0-9a-f]*'`,
    ),
    check("system_oidc_access_tokens_expiration", sql`${table.expiresAt} > ${table.createdAt}`),
  ],
)

export type SystemOidcAccessTokenRow = InferSelectModel<typeof systemOidcAccessTokens>

/** namespaced permissionを束ねるSystem Role。permission vocabulary自体は各contextが所有する。 */
export const systemIamRoles = sqliteTable(
  "system_iam_roles",
  {
    id: text("id").primaryKey(),
    /** UUID の主キーへ移す前の主キー。移行前の記録を現在の行へ辿るために残す。 */
    legacyId: text("legacy_id").unique(),
    key: text("key").notNull(),
    kind: text("kind", { enum: ["managed", "custom"] }).notNull(),
    name: text("name").notNull(),
    description: text("description"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
    /** null はglobal、値ありはそのresource typeへだけ割当可能。 */
    resourceType: text("resource_type"),
  },
  (table) => [
    uniqueIndex("system_iam_roles_key_uniq").on(table.key),
    check("system_iam_roles_key_length", sql`length(${table.key}) BETWEEN 3 AND 100`),
    check("system_iam_roles_kind", sql`${table.kind} IN ('managed', 'custom')`),
    check(
      "system_iam_roles_resource_type_length",
      sql`${table.resourceType} IS NULL OR length(${table.resourceType}) BETWEEN 3 AND 100`,
    ),
    check("system_iam_roles_name_length", sql`length(${table.name}) BETWEEN 1 AND 100`),
    check(
      "system_iam_roles_description_length",
      sql`${table.description} IS NULL OR length(${table.description}) BETWEEN 1 AND 1000`,
    ),
    check("system_iam_roles_chronology", sql`${table.updatedAt} >= ${table.createdAt}`),
  ],
)

export type SystemIamRoleRow = InferSelectModel<typeof systemIamRoles>

export const systemIamRolePermissions = sqliteTable(
  "system_iam_role_permissions",
  {
    id: text("id")
      .primaryKey()
      .notNull()
      .$defaultFn(() => crypto.randomUUID()),
    roleId: text("role_id")
      .notNull()
      .references(() => systemIamRoles.id, { onDelete: "cascade" }),
    permissionKey: text("permission_key").notNull(),
  },
  (table) => [
    unique("system_iam_role_permissions_role_permission_uniq").on(
      table.roleId,
      table.permissionKey,
    ),
    check(
      "system_iam_role_permissions_key_length",
      sql`length(${table.permissionKey}) BETWEEN 3 AND 100`,
    ),
  ],
)

export type SystemIamRolePermissionRow = InferSelectModel<typeof systemIamRolePermissions>

/** AccountEntityへRoleをglobalまたはopaque resource単位で割り当てる。 */
export const systemRoleBindings = sqliteTable(
  "system_role_bindings",
  {
    id: text("id").primaryKey(),
    /** UUID の主キーへ移す前の主キー。移行前の記録を現在の行へ辿るために残す。 */
    legacyId: text("legacy_id").unique(),
    accountId: text("account_id")
      .notNull()
      .references(() => systemAccounts.id, { onDelete: "restrict" }),
    roleId: text("role_id")
      .notNull()
      .references(() => systemIamRoles.id, { onDelete: "restrict" }),
    resourceType: text("resource_type"),
    resourceId: text("resource_id"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    revokedAt: integer("revoked_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    uniqueIndex("system_role_bindings_active_uniq")
      .on(
        table.accountId,
        table.roleId,
        sql`coalesce(${table.resourceType}, '')`,
        sql`coalesce(${table.resourceId}, '')`,
      )
      .where(sql`${table.revokedAt} IS NULL`),
    index("system_role_bindings_account_idx").on(table.accountId, table.createdAt),
    index("system_role_bindings_role_idx").on(table.roleId, table.createdAt),
    index("system_role_bindings_resource_idx").on(table.resourceType, table.resourceId),
    check(
      "system_role_bindings_resource_pair",
      sql`(${table.resourceType} IS NULL AND ${table.resourceId} IS NULL) OR (
        ${table.resourceType} IS NOT NULL AND ${table.resourceId} IS NOT NULL
        AND length(${table.resourceType}) BETWEEN 3 AND 100
        AND length(${table.resourceId}) BETWEEN 1 AND 255
      )`,
    ),
    check(
      "system_role_bindings_chronology",
      sql`${table.revokedAt} IS NULL OR ${table.revokedAt} >= ${table.createdAt}`,
    ),
  ],
)

export type SystemRoleBindingRow = InferSelectModel<typeof systemRoleBindings>

/** Accountの作成権限を一度だけ委譲するportableなSystem招待。業務payloadは下流contextが衛星化する。 */
export const systemAccountInvitations = sqliteTable(
  "system_account_invitations",
  {
    id: text("id").primaryKey(),
    token: text("token").notNull(),
    email: text("subject"),
    roleId: text("role_id")
      .notNull()
      .references(() => systemIamRoles.id, { onDelete: "restrict" }),
    resourceType: text("resource_type"),
    resourceId: text("resource_id"),
    relatedResourceId: text("related_resource_id"),
    usedBy: text("accepted_by_account_id").references(() => systemAccounts.id, {
      onDelete: "restrict",
    }),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    revokedAt: integer("revoked_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("system_account_invitations_token_uniq").on(table.token),
    index("system_account_invitations_role_idx").on(table.roleId, table.createdAt),
    index("system_account_invitations_subject_idx").on(table.email, table.createdAt),
    index("system_account_invitations_resource_idx").on(table.resourceType, table.resourceId),
    check("system_account_invitations_id_length", sql`length(${table.id}) BETWEEN 1 AND 255`),
    check(
      "system_account_invitations_chronology",
      sql`${table.updatedAt} >= ${table.createdAt}
        AND ${table.expiresAt} >= ${table.createdAt}
        AND (${table.revokedAt} IS NULL OR ${table.revokedAt} >= ${table.createdAt})`,
    ),
    check(
      "system_account_invitations_resource_pair",
      sql`(${table.resourceType} IS NULL AND ${table.resourceId} IS NULL) OR (
        ${table.resourceType} IS NOT NULL AND ${table.resourceId} IS NOT NULL
        AND length(${table.resourceType}) BETWEEN 3 AND 100
        AND length(${table.resourceId}) BETWEEN 1 AND 255
      )`,
    ),
    check(
      "system_account_invitations_related_resource",
      sql`${table.relatedResourceId} IS NULL OR (
        ${table.resourceType} IS NOT NULL AND ${table.resourceId} IS NOT NULL
        AND length(${table.relatedResourceId}) BETWEEN 1 AND 255
      )`,
    ),
  ],
)

export type SystemAccountInvitationRow = InferSelectModel<typeof systemAccountInvitations>

/** 受信者と既読状態を持たないimmutableなplain-text notification message。 */
export const systemNotificationMessages = sqliteTable(
  "system_notification_messages",
  {
    id: text("id").primaryKey(),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    actionUrl: text("action_url"),
    actionType: text("action_type"),
    actionId: text("action_id"),
    priority: text("priority", { enum: ["low", "normal", "high", "critical"] })
      .notNull()
      .default("normal"),
    dedupeKey: text("dedupe_key"),
    sourceType: text("source_type"),
    sourceId: text("source_id"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("system_notification_messages_source_idx").on(table.sourceType, table.sourceId),
    index("system_notification_messages_priority_idx").on(table.priority, table.createdAt),
    uniqueIndex("system_notification_messages_dedupe_key_uniq").on(table.dedupeKey),
    check("system_notification_messages_id_length", sql`length(${table.id}) BETWEEN 1 AND 255`),
    check("system_notification_messages_kind_length", sql`length(${table.kind}) BETWEEN 3 AND 100`),
    check(
      "system_notification_messages_title_length",
      sql`length(${table.title}) BETWEEN 1 AND 200`,
    ),
    check(
      "system_notification_messages_body_length",
      sql`${table.body} IS NULL OR length(${table.body}) BETWEEN 1 AND 10000`,
    ),
    check(
      "system_notification_messages_action_url_length",
      sql`${table.actionUrl} IS NULL OR length(${table.actionUrl}) BETWEEN 1 AND 2048`,
    ),
    check(
      "system_notification_messages_priority",
      sql`${table.priority} IN ('low', 'normal', 'high', 'critical')`,
    ),
    check(
      "system_notification_messages_source_pair",
      sql`(${table.sourceType} IS NULL AND ${table.sourceId} IS NULL) OR (
        ${table.sourceType} IS NOT NULL AND ${table.sourceId} IS NOT NULL
        AND length(${table.sourceType}) BETWEEN 3 AND 100
        AND length(${table.sourceId}) BETWEEN 1 AND 512
      )`,
    ),
    check(
      "system_notification_messages_action_pair",
      sql`(${table.actionType} IS NULL AND ${table.actionId} IS NULL) OR (
        ${table.actionType} IS NOT NULL AND ${table.actionId} IS NOT NULL
        AND length(${table.actionType}) BETWEEN 3 AND 100
        AND length(${table.actionId}) BETWEEN 1 AND 512
      )`,
    ),
  ],
)

export type SystemNotificationMessageRow = InferSelectModel<typeof systemNotificationMessages>

/** 業務語彙を解釈せず、通知の開示範囲を外部resource識別子へ結び付ける1:1 scope。 */
export const systemNotificationResourceScopes = sqliteTable(
  "system_notification_resource_scopes",
  {
    messageId: text("message_id")
      .primaryKey()
      .references(() => systemNotificationMessages.id, { onDelete: "cascade" }),
    resourceType: text("resource_type").notNull(),
    resourceId: text("resource_id").notNull(),
  },
  (table) => [
    index("system_notification_resource_scopes_resource_idx").on(
      table.resourceType,
      table.resourceId,
      table.messageId,
    ),
    check(
      "system_notification_resource_scopes_type_length",
      sql`length(${table.resourceType}) BETWEEN 3 AND 100`,
    ),
    check(
      "system_notification_resource_scopes_id_length",
      sql`length(${table.resourceId}) BETWEEN 1 AND 512`,
    ),
  ],
)

export type SystemNotificationResourceScopeRow = InferSelectModel<
  typeof systemNotificationResourceScopes
>

/** concrete AccountEntity宛てのdeliveryと単調なread receipt。 */
export const systemNotificationDeliveries = sqliteTable(
  "system_notification_deliveries",
  {
    id: text("id").primaryKey(),
    messageId: text("message_id")
      .notNull()
      .references(() => systemNotificationMessages.id, { onDelete: "restrict" }),
    recipientAccountId: text("recipient_account_id")
      .notNull()
      .references(() => systemAccounts.id, { onDelete: "restrict" }),
    deliveredAt: integer("delivered_at", { mode: "timestamp_ms" }).notNull(),
    readAt: integer("read_at", { mode: "timestamp_ms" }),
    dismissedAt: integer("dismissed_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    uniqueIndex("system_notification_deliveries_message_account_uniq").on(
      table.messageId,
      table.recipientAccountId,
    ),
    index("system_notification_deliveries_account_idx").on(
      table.recipientAccountId,
      table.deliveredAt,
    ),
    index("system_notification_deliveries_unread_idx")
      .on(table.recipientAccountId, table.deliveredAt)
      .where(sql`${table.readAt} IS NULL AND ${table.dismissedAt} IS NULL`),
    check("system_notification_deliveries_id_length", sql`length(${table.id}) BETWEEN 1 AND 255`),
    check(
      "system_notification_deliveries_read_chronology",
      sql`${table.readAt} IS NULL OR ${table.readAt} >= ${table.deliveredAt}`,
    ),
    check(
      "system_notification_deliveries_dismiss_chronology",
      sql`${table.dismissedAt} IS NULL OR ${table.dismissedAt} >= ${table.deliveredAt}`,
    ),
  ],
)

export type SystemNotificationDeliveryRow = InferSelectModel<typeof systemNotificationDeliveries>

/** 業務内容を解釈せず、非同期処理の実行状態だけを追跡する。 */
export const systemBatchJobs = sqliteTable(
  "system_batch_jobs",
  {
    id: text("id").primaryKey().notNull(),
    /** 主キーを UUID へ移す前の整数の主キー。移行前の記録を現在の行へ辿るために残す。 */
    legacyId: text("legacy_id").unique(),
    name: text("name").notNull(),
    status: text("status").notNull().$type<SystemBatchJobStatus>(),
    startedAt: integer("started_at", { mode: "timestamp_ms" }),
    finishedAt: integer("finished_at", { mode: "timestamp_ms" }),
    message: text("message"),
  },
  (table) => [
    index("system_batch_jobs_status_idx").on(table.status, table.id),
    check("system_batch_jobs_name_length", sql`length(${table.name}) BETWEEN 1 AND 200`),
    check("system_batch_jobs_status", sql`${table.status} IN ('running', 'completed', 'failed')`),
    check(
      "system_batch_jobs_chronology",
      sql`${table.finishedAt} IS NULL OR ${table.startedAt} IS NULL OR ${table.finishedAt} >= ${table.startedAt}`,
    ),
  ],
)

export type SystemBatchJobRow = InferSelectModel<typeof systemBatchJobs>

/** AccountEntity lifecycle後も残るappend-onlyなsecurity audit envelope。 */
export const systemAuditEvents = sqliteTable(
  "system_audit_events",
  {
    eventId: text("event_id").primaryKey(),
    actorAccountId: text("actor_account_id"),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id"),
    outcome: text("outcome").notNull().$type<SystemAuditOutcome>(),
    reasonCode: text("reason_code"),
    authorizationJson: text("authorization_json"),
    beforeJson: text("before_json"),
    afterJson: text("after_json"),
    metadataJson: text("metadata_json"),
    occurredAt: integer("occurred_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("system_audit_events_actor_idx").on(table.actorAccountId, table.occurredAt),
    index("system_audit_events_action_idx").on(table.action, table.occurredAt),
    index("system_audit_events_target_idx").on(table.targetType, table.targetId, table.occurredAt),
    index("system_audit_events_outcome_idx").on(table.outcome, table.occurredAt),
    check("system_audit_events_action_length", sql`length(${table.action}) BETWEEN 3 AND 200`),
    check(
      "system_audit_events_target_type_length",
      sql`length(${table.targetType}) BETWEEN 1 AND 200`,
    ),
    check(
      "system_audit_events_outcome",
      sql`${table.outcome} IN ('succeeded', 'denied', 'failed')`,
    ),
    check(
      "system_audit_events_authorization_json",
      sql`${table.authorizationJson} IS NULL OR json_valid(${table.authorizationJson})`,
    ),
    check(
      "system_audit_events_before_json",
      sql`${table.beforeJson} IS NULL OR json_valid(${table.beforeJson})`,
    ),
    check(
      "system_audit_events_after_json",
      sql`${table.afterJson} IS NULL OR json_valid(${table.afterJson})`,
    ),
    check(
      "system_audit_events_metadata_json",
      sql`${table.metadataJson} IS NULL OR json_valid(${table.metadataJson})`,
    ),
  ],
)

export type SystemAuditEventRow = InferSelectModel<typeof systemAuditEvents>

/** AccountEntity・Identity・global root Bindingだけで完結するsingle-use bootstrap marker。 */
export const systemBootstrapState = sqliteTable(
  "system_bootstrap_state",
  {
    singleton: integer("singleton").primaryKey(),
    completedByAccountId: text("completed_by_account_id")
      .notNull()
      .unique()
      .references(() => systemAccounts.id, { onDelete: "restrict" }),
    rootBindingId: text("root_binding_id")
      .notNull()
      .unique()
      .references(() => systemRoleBindings.id, { onDelete: "restrict" }),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [check("system_bootstrap_state_singleton", sql`${table.singleton} = 1`)],
)

export type SystemBootstrapStateRow = InferSelectModel<typeof systemBootstrapState>

/** 監査の開示条件はscopeごとの変更不能な版を正本とする。 */
export const systemAuditDisclosurePolicyRevisions = sqliteTable(
  "system_audit_disclosure_policy_revisions",
  {
    id: text("id").primaryKey().notNull(),
    scope: text("scope").notNull(),
    revision: integer("revision").notNull(),
    commandId: text("command_id").notNull().unique(),
    enabled: integer("enabled", { mode: "boolean" }).notNull(),
    allowedFields: text("allowed_fields_json", { mode: "json" })
      .notNull()
      .$type<SystemAuditDisclosurePolicyEntity["snapshot"]["allowedFields"]>(),
    allowedTargetTypes: text("allowed_target_types_json", { mode: "json" }).$type<
      ReadonlyArray<string>
    >(),
    allowedPurposes: text("allowed_purposes_json", { mode: "json" }).$type<ReadonlyArray<string>>(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
    reason: text("reason").notNull(),
    actorAccountId: text("actor_account_id")
      .notNull()
      .references(() => systemAccounts.id, { onDelete: "restrict" }),
    recordedAt: integer("recorded_at", { mode: "timestamp_ms" }).notNull(),
    auditEventId: text("audit_event_id")
      .notNull()
      .unique()
      .references(() => systemAuditEvents.eventId, { onDelete: "restrict" }),
  },
  (table) => [
    uniqueIndex("system_audit_disclosure_scope_revision_uniq").on(table.scope, table.revision),
    check("system_audit_disclosure_revision", sql`${table.revision} > 0`),
    check(
      "system_audit_disclosure_expiry",
      sql`${table.expiresAt} IS NULL OR ${table.expiresAt} > ${table.recordedAt}`,
    ),
  ],
)

export const systemCoreSchema = {
  systemAccounts,
  systemIdentityBindings,
  systemIdentityProfiles,
  systemPasswordCredentials,
  systemPasswordResetChallenges,
  systemAuthenticationAttempts,
  systemSessions,
  systemIdentityLoginTokens,
  systemCliLoginStates,
  systemCliLoginCodes,
  systemBrowserLoginCodes,
  systemOidcAuthorizationCodes,
  systemOidcAccessTokens,
  systemIamRoles,
  systemIamRolePermissions,
  systemRoleBindings,
  systemNotificationMessages,
  systemNotificationResourceScopes,
  systemNotificationDeliveries,
  systemAccountInvitations,
  systemBatchJobs,
  systemAuditEvents,
  systemAuditDisclosurePolicyRevisions,
  systemBootstrapState,
}
