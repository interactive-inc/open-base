import type { SystemReadAuthentication } from "@system/domain/definitions/system-read-authentication.definition"
import { systemWorkItemSchema } from "@system/infrastructure/schema/system-work-item"
import type { OidcClientRegistryValue } from "@system/domain/values/oauth/oidc-client-registry.value"
import type { OidcIssuerConfigurationValue } from "@system/domain/values/oauth/oidc-issuer-configuration.value"
import type { AccessTokenClaims } from "@system/domain/schemas/auth/access-token-claims.schema"
import * as systemAttachmentSchema from "@system/infrastructure/schema/system-attachment"
import * as systemCoreSchema from "@system/infrastructure/schema/system-core"
import * as systemDeliverySchema from "@system/infrastructure/schema/system-delivery"
import * as systemIntegrationSchema from "@system/infrastructure/schema/system-integration"
import * as systemOperationReceiptSchema from "@system/infrastructure/schema/system-operation-receipt"
import * as systemPrincipalSchema from "@system/infrastructure/schema/system-principal"
import * as systemProcedureSchema from "@system/infrastructure/schema/system-procedure"
import * as systemProcedureDelegationSchema from "@system/infrastructure/schema/system-procedure-delegation"
import * as systemRelationsSchema from "@system/infrastructure/schema/system-relations"
import * as systemWorkflowSchema from "@system/infrastructure/schema/system-workflow"
import type { DrizzleD1Database } from "drizzle-orm/d1"

export const systemSchema = {
  ...systemAttachmentSchema,
  ...systemCoreSchema,
  ...systemWorkItemSchema,
  ...systemDeliverySchema,
  ...systemIntegrationSchema,
  ...systemOperationReceiptSchema,
  ...systemPrincipalSchema,
  ...systemProcedureSchema,
  ...systemProcedureDelegationSchema,
  ...systemRelationsSchema,
  ...systemWorkflowSchema,
}

type SystemDrizzleDatabase = DrizzleD1Database<typeof systemSchema>

/** System Infrastructureが利用できる、relation queryを除いたDrizzle操作。 */
export type SystemDatabase = Pick<
  SystemDrizzleDatabase,
  "batch" | "delete" | "insert" | "select" | "update"
>

export type SystemDatabaseContext = Readonly<{
  var: Readonly<{ database: SystemDatabase }>
}>

export type SystemD1Context = Readonly<{
  env: Readonly<{ DB: D1Database }>
}>

export type SystemClockContext = Readonly<{
  var: Readonly<{ now: () => Date }>
}>

export type SystemAuthorizationContext = Readonly<{
  var: Readonly<{
    accountTokenVersion: number
    permissions: ReadonlySet<string>
    scopedPermissions?: ReadonlyMap<string, ReadonlySet<string>>
    role: string
    roleKeys?: ReadonlyArray<string>
    userId: string
    systemAccessToken?: AccessTokenClaims
    bearerReadAuthentication?: SystemReadAuthentication
  }>
}>

export type SystemRequestAudit = Readonly<{
  requestId: string
  clientName: "web" | "cli" | "api" | "system"
  clientIp: string | null
  externalRequestId: string | null
}>

export type SystemRequestAuditContext = Readonly<{
  var: Readonly<{ auditContext: SystemRequestAudit }>
}>

export type SystemJwtSecretContext = Readonly<{
  env: Readonly<{ JWT_SECRET?: string }>
}>

export type SystemSessionConfigurationContext = Readonly<{
  env: Readonly<{
    SYSTEM_SESSION_TTL_SECONDS?: string
    SYSTEM_SESSION_MAX_LIFETIME_SECONDS?: string
  }>
}>

export type SystemExternalIdentityContext = Readonly<{
  env: Readonly<{
    IDENTITY_JWKS?: string
    IDENTITY_ISSUER?: string
    IDENTITY_AUDIENCE?: string
    IDENTITY_ACCESS_TOKEN_ISSUER?: string
    IDENTITY_ACCESS_TOKEN_AUDIENCE?: string
    IDENTITY_LOGIN_URL?: string
    API_ORIGIN?: string
  }>
}>

export type SystemOidcSigningContext = Readonly<{
  env: Readonly<{ OIDC_SIGNING_KEYS?: string }>
}>

export type SystemOidcConfigurationContext = Readonly<{
  var: Readonly<{
    oidcClientRegistry: OidcClientRegistryValue
    oidcIssuerConfiguration: OidcIssuerConfigurationValue
  }>
}>

export type SystemPasswordHashContext = Readonly<{
  env: Readonly<{ PEPPER_SECRET?: string }>
}>

export type SystemBootstrapContext = Readonly<{
  env: Readonly<{ BOOTSTRAP_TOKEN?: string }>
}>

type SystemEmailAddress = Readonly<{
  name: string
  email: string
}>

type SystemEmailMessage = Readonly<{
  from: string | SystemEmailAddress
  to: string | SystemEmailAddress | ReadonlyArray<string | SystemEmailAddress>
  subject: string
  replyTo?: string | SystemEmailAddress
  cc?: string | SystemEmailAddress | ReadonlyArray<string | SystemEmailAddress>
  bcc?: string | SystemEmailAddress | ReadonlyArray<string | SystemEmailAddress>
  headers?: Readonly<Record<string, string>>
  text?: string
  html?: string
}>

export type SystemEmailSender = Readonly<{
  send(message: SystemEmailMessage): Promise<unknown>
}>

export type SystemEmailContext = Readonly<{
  env: Readonly<{
    EMAIL?: SystemEmailSender
    EMAIL_SENDER_NAME?: string
    INVITE_EMAIL_FROM?: string
    INVITE_EMAIL_SEND_ENABLED?: string
  }>
}>

export type SystemAttachmentStorageContext = Readonly<{
  env: Readonly<{
    ATTACHMENTS?: R2Bucket
    ATTACHMENT_KEKS?: string
  }>
}>
