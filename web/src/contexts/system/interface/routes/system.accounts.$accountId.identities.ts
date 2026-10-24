import { SYSTEM_AUDIT_ACTIONS } from "@system/domain/catalogs/audit/system-audit-action.catalog"
import {
  SystemAccountNotFoundError,
  SystemForbiddenError,
  SystemIdentityConflictError,
  SystemIdentityInvalidError,
  SystemIdentityUnavailableError,
  SystemInvalidSessionError,
} from "@system/interface/errors"
/** /system/accounts/:accountId/identities */
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { StableSystemAuditJsonValue } from "@system/domain/values/audit/stable-system-audit-json.value"
import { IdentityBindingEntity } from "@system/domain/entities/identity-binding.entity"
import { SystemAuditEventRepository } from "@system/infrastructure/repositories/audit/system-audit-event.repository"
import { SystemAccountCatalogRepository } from "@system/infrastructure/repositories/iam/system-account-catalog.repository"
import { SystemIdentityCatalogRepository } from "@system/infrastructure/repositories/identity/system-identity-catalog.repository"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import { requireSystemStepUp } from "@system/interface/middlewares/require-system-step-up"
import { issueSystemPasskeyEnrollment } from "@system/interface/operations/issue-system-passkey-enrollment"
import { systemFactory } from "@system/interface/request-environment/system-factory"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization permission iam:read - AccountのIdentity bindingと公開profileだけを読む
export const GET = systemFactory.createHandlers(authenticateSystemAccessToken, async (context) => {
  if (!context.var.permissions.has("system:admin") && !context.var.permissions.has("iam:read")) {
    throw new SystemForbiddenError()
  }
  const accountId = zAccountId.safeParse(context.req.param("accountId"))
  if (!accountId.success) {
    throw new SystemAccountNotFoundError()
  }
  const account = await new SystemAccountCatalogRepository({
    env: { DB: context.env.DB },
  }).find(accountId.data)
  if (account instanceof Error) {
    throw new SystemIdentityUnavailableError()
  }
  if (account === null) {
    throw new SystemAccountNotFoundError()
  }
  const identities = await new SystemIdentityCatalogRepository({
    env: { DB: context.env.DB },
  }).findMany(accountId.data)
  if (identities instanceof Error) {
    throw new SystemIdentityUnavailableError()
  }

  return context.json(
    {
      identities: identities.map((identity) => ({
        id: identity.binding.id,
        account_id: identity.binding.accountId,
        provider: identity.binding.provider,
        subject: identity.binding.subject,
        state: identity.binding.state,
        email: identity.email,
        email_verified: identity.isEmailVerified,
        last_used_at: identity.lastUsedAt?.toISOString() ?? null,
        created_at: identity.binding.createdAt.toISOString(),
        activated_at: identity.binding.activatedAt?.toISOString() ?? null,
        revoked_at: identity.binding.revokedAt?.toISOString() ?? null,
      })),
      total: identities.length,
    },
    200,
  )
})

// @authorization permission iam:write - Identityを作り、パスキーのIdentityには登録用の招待を発行する
export const POST = systemFactory.createHandlers(
  authenticateSystemAccessToken,
  requireSystemStepUp,
  zValidator(
    "json",
    z.discriminatedUnion("provider", [
      z
        .object({
          provider: z.literal("passkey"),
          email: z
            .string()
            .trim()
            .toLowerCase()
            .email()
            .min(3)
            .max(254)
            .regex(/^[\x20-\x7e]+$/),
        })
        .strict(),
      z
        .object({
          provider: z.enum(["google", "github", "oidc"]),
          subject: z
            .string()
            .min(1)
            .max(255)
            .regex(/^[\x20-\x7e]+$/),
          email: z.string().trim().toLowerCase().email().max(254).nullable(),
          email_verified: z.boolean(),
        })
        .strict(),
    ]),
  ),
  async (context) => {
    if (!context.var.permissions.has("system:admin") && !context.var.permissions.has("iam:write")) {
      throw new SystemForbiddenError()
    }
    const actorAccountId = zAccountId.safeParse(context.var.userId)
    const targetAccountId = zAccountId.safeParse(context.req.param("accountId"))
    if (!actorAccountId.success) {
      throw new SystemInvalidSessionError()
    }
    if (!targetAccountId.success) {
      throw new SystemAccountNotFoundError()
    }
    const now = context.var.now()
    if (!Number.isSafeInteger(now.getTime())) {
      throw new SystemIdentityUnavailableError()
    }
    const body = context.req.valid("json")
    // パスキーのIdentityはBetter AuthのユーザーIDとなるAccount IDをsubjectにし、登録が済むまで未登録にする。
    const isPasskey = body.provider === "passkey"
    const subject = isPasskey ? targetAccountId.data : body.subject
    const email = body.email
    const isEmailVerified = isPasskey ? true : body.email_verified
    const binding = IdentityBindingEntity.create({
      id: crypto.randomUUID(),
      accountId: targetAccountId.data,
      provider: body.provider,
      subject,
      createdAt: now,
      activatedAt: isPasskey ? null : now,
      revokedAt: null,
    })
    if (binding instanceof Error) {
      throw new SystemIdentityInvalidError()
    }
    const afterJson = StableSystemAuditJsonValue.create({
      account_id: binding.accountId,
      email,
      email_verified: isEmailVerified,
      provider: binding.provider,
      subject: binding.subject,
    })
    if (afterJson instanceof Error) {
      throw new SystemIdentityUnavailableError()
    }
    const auditEvent = SystemAuditEventEntity.create({
      actorAccountId: actorAccountId.data,
      action: SYSTEM_AUDIT_ACTIONS.systemIdentityCreated,
      targetType: "system:identity",
      targetId: binding.id,
      outcome: "succeeded",
      reasonCode: null,
      authorizationJson: null,
      beforeJson: null,
      afterJson: afterJson?.toString() ?? null,
      metadataJson: null,
      occurredAt: now,
    })
    if (auditEvent instanceof Error) {
      throw new SystemIdentityUnavailableError()
    }
    const auditStatements = new SystemAuditEventRepository({
      env: { DB: context.env.DB },
    }).prepareAppend(auditEvent)
    const creation = await new SystemIdentityCatalogRepository({
      env: { DB: context.env.DB },
    }).create({
      actorAccountId: actorAccountId.data,
      binding,
      email,
      isEmailVerified,
      auditStatements,
    })
    if (creation instanceof Error) {
      throw new SystemIdentityUnavailableError()
    }
    if (creation === "forbidden") {
      throw new SystemForbiddenError()
    }
    if (creation === "conflict") {
      throw new SystemIdentityConflictError()
    }
    const enrollment = isPasskey
      ? await issueSystemPasskeyEnrollment(
          { env: { DB: context.env.DB } },
          {
            accountId: targetAccountId.data,
            reason: "provisioning",
            issuedByAccountId: actorAccountId.data,
            now,
          },
        )
      : null
    if (enrollment instanceof Error || enrollment === "no_identity") {
      throw new SystemIdentityUnavailableError()
    }

    return context.json(
      {
        id: binding.id,
        account_id: binding.accountId,
        provider: binding.provider,
        subject: binding.subject,
        state: binding.state,
        email,
        email_verified: isEmailVerified,
        last_used_at: null,
        created_at: binding.createdAt.toISOString(),
        activated_at: binding.activatedAt?.toISOString() ?? null,
        revoked_at: null,
        // パスキーの登録に使う招待。tokenはこの応答でだけ返す。
        passkey_enrollment:
          enrollment === null
            ? null
            : { token: enrollment.token, expires_at: enrollment.expiresAt.toISOString() },
      },
      201,
    )
  },
)
