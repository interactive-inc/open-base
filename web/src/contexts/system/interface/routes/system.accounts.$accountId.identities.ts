import { SYSTEM_AUDIT_ACTIONS } from "@system/domain/catalogs/audit/system-audit-action.catalog"
import {
  SystemAccountNotFoundError,
  SystemForbiddenError,
  SystemIdentityConflictError,
  SystemIdentityInvalidError,
  SystemIdentityUnavailableError,
  SystemInvalidSessionError,
  SystemPasswordInvalidError,
} from "@system/interface/errors"
/** /system/accounts/:accountId/identities */
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { SystemPasswordValue } from "@system/domain/values/auth/system-password.value"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { StableSystemAuditJsonValue } from "@system/domain/values/audit/stable-system-audit-json.value"
import { IdentityBindingEntity } from "@system/domain/entities/identity-binding.entity"
import { hashPassword } from "@system/lib/auth/hash-password"
import { SystemAuditEventRepository } from "@system/infrastructure/repositories/audit/system-audit-event.repository"
import { SystemAccountCatalogRepository } from "@system/infrastructure/repositories/iam/system-account-catalog.repository"
import { SystemIdentityCatalogRepository } from "@system/infrastructure/repositories/identity/system-identity-catalog.repository"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import { requireSystemStepUp } from "@system/interface/middlewares/require-system-step-up"
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

// @authorization permission iam:write - provider credentialをIdentityと同じtransactionで作る
export const POST = systemFactory.createHandlers(
  authenticateSystemAccessToken,
  requireSystemStepUp,
  zValidator(
    "json",
    z.discriminatedUnion("provider", [
      z
        .object({
          provider: z.literal("password"),
          email: z
            .string()
            .trim()
            .toLowerCase()
            .email()
            .min(3)
            .max(254)
            .regex(/^[\x20-\x7e]+$/),
          password: z.string().min(12).max(200),
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
    if (
      body.provider === "password" &&
      !(SystemPasswordValue.create(body.password) instanceof SystemPasswordValue)
    ) {
      throw new SystemPasswordInvalidError()
    }
    const subject = body.provider === "password" ? body.email : body.subject
    const email = body.email
    const isEmailVerified = body.provider === "password" ? true : body.email_verified
    const binding = IdentityBindingEntity.create({
      id: crypto.randomUUID(),
      accountId: targetAccountId.data,
      provider: body.provider,
      subject,
      createdAt: now,
      activatedAt: now,
      revokedAt: null,
    })
    if (binding instanceof Error) {
      throw new SystemIdentityInvalidError()
    }
    const pepper = context.env.PEPPER_SECRET
    if (body.provider === "password" && (pepper === undefined || pepper.length === 0)) {
      throw new SystemIdentityUnavailableError()
    }
    const passwordHash =
      body.provider === "password" && pepper !== undefined
        ? await hashPassword(body.password, pepper).catch((caught: unknown) =>
            caught instanceof Error ? caught : new Error("failed to hash System password"),
          )
        : null
    if (passwordHash instanceof Error) {
      console.error(
        JSON.stringify({ event: "system_identity_password_hash_failed", error: passwordHash.name }),
      )
      throw new SystemIdentityUnavailableError()
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
      passwordHash,
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
      },
      201,
    )
  },
)
