import { SYSTEM_AUDIT_ACTIONS } from "@system/domain/catalogs/audit/system-audit-action.catalog"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { SystemPrincipalEntity } from "@system/domain/entities/system-principal.entity"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { StableSystemAuditJsonValue } from "@system/domain/values/audit/stable-system-audit-json.value"
import { SystemAuditEventRepository } from "@system/infrastructure/repositories/audit/system-audit-event.repository"
import { SystemPrincipalRepository } from "@system/infrastructure/repositories/iam/system-principal.repository"
import { authorizeSystemOperation } from "@system/interface/authorization/authorize-system-operation"
import {
  SystemForbiddenError,
  SystemPrincipalConflictError,
  SystemPrincipalInvalidError,
  SystemPrincipalUnavailableError,
} from "@system/interface/errors"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import { requireSystemStepUp } from "@system/interface/middlewares/require-system-step-up"
import { systemFactory } from "@system/interface/request-environment/system-factory"
import { systemPrincipalResponse } from "@system/interface/responses/system-principal-response"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

const createBody = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("agent"), name: z.string().trim().min(1).max(200) }).strict(),
  z.object({ kind: z.literal("service"), name: z.string().trim().min(1).max(200) }).strict(),
  z
    .object({
      kind: z.literal("connector"),
      name: z.string().trim().min(1).max(200),
      connector_id: z.string().regex(/^\S{1,255}$/),
    })
    .strict(),
])

// @authorization permission iam:read - Accountと独立したPrincipal分類を読む
export const GET = systemFactory.createHandlers(authenticateSystemAccessToken, async (context) => {
  if (!authorizeSystemOperation(context.var.permissions, "iam:read", context.var.now())) {
    throw new SystemForbiddenError()
  }
  const principals = await new SystemPrincipalRepository({ env: { DB: context.env.DB } }).findMany()
  if (principals instanceof Error) throw new SystemPrincipalUnavailableError(principals)

  return context.json({ principals: principals.map(systemPrincipalResponse) }, 200)
})

// @authorization permission iam:write - step-up後に非Human Principalと専用Accountを原子的に作る
export const POST = systemFactory.createHandlers(
  authenticateSystemAccessToken,
  requireSystemStepUp,
  zValidator("json", createBody),
  async (context) => {
    const now = context.var.now()
    if (!authorizeSystemOperation(context.var.permissions, "iam:write", now)) {
      throw new SystemForbiddenError()
    }
    const accountId = zAccountId.safeParse(crypto.randomUUID())
    if (!accountId.success) throw new SystemPrincipalUnavailableError(accountId.error)
    const body = context.req.valid("json")
    const principal = SystemPrincipalEntity.create({
      id: crypto.randomUUID(),
      accountId: accountId.data,
      kind: body.kind,
      name: body.name,
      connectorId: body.kind === "connector" ? body.connector_id : null,
      revision: 1,
      createdAt: now,
      updatedAt: now,
    })
    if (principal instanceof Error) throw new SystemPrincipalInvalidError(principal)
    const after = StableSystemAuditJsonValue.create(systemPrincipalResponse(principal))
    if (after === null || after instanceof Error) throw new SystemPrincipalUnavailableError(after)
    const event = SystemAuditEventEntity.create({
      actorAccountId: context.var.userId,
      action: SYSTEM_AUDIT_ACTIONS.systemPrincipalCreated,
      targetType: "system:principal",
      targetId: principal.id,
      outcome: "succeeded",
      reasonCode: null,
      authorizationJson: null,
      beforeJson: null,
      afterJson: after.toString(),
      metadataJson: null,
      occurredAt: now,
    })
    if (event instanceof Error) throw new SystemPrincipalUnavailableError(event)
    const systemContext = { env: { DB: context.env.DB } }
    const creation = await new SystemPrincipalRepository(systemContext).create(
      principal,
      new SystemAuditEventRepository(systemContext).prepareAppend(event),
    )
    if (creation instanceof Error) throw new SystemPrincipalUnavailableError(creation)
    if (creation === "conflict") throw new SystemPrincipalConflictError()

    return context.json({ principal: systemPrincipalResponse(principal) }, 201)
  },
)
