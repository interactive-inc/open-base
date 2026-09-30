import { SYSTEM_AUDIT_ACTIONS } from "@system/domain/catalogs/audit/system-audit-action.catalog"
import {
  SystemAccountConflictError,
  SystemAccountUnavailableError,
  SystemForbiddenError,
} from "@system/interface/errors"
/** /system/accounts */
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { StableSystemAuditJsonValue } from "@system/domain/values/audit/stable-system-audit-json.value"
import { SystemAuditEventRepository } from "@system/infrastructure/repositories/audit/system-audit-event.repository"
import { SystemAccountCatalogRepository } from "@system/infrastructure/repositories/iam/system-account-catalog.repository"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import { requireSystemStepUp } from "@system/interface/middlewares/require-system-step-up"
import { systemFactory } from "@system/interface/request-environment/system-factory"

// @authorization permission iam:read - Company profileを含まないSystem Accountだけを読む
export const GET = systemFactory.createHandlers(authenticateSystemAccessToken, async (context) => {
  if (!context.var.permissions.has("system:admin") && !context.var.permissions.has("iam:read")) {
    throw new SystemForbiddenError()
  }

  const accounts = await new SystemAccountCatalogRepository({
    env: { DB: context.env.DB },
  }).findMany()
  if (accounts instanceof Error) {
    throw new SystemAccountUnavailableError()
  }

  return context.json(
    {
      accounts: accounts.map((account) => ({
        id: account.id,
        status: account.status,
        token_version: account.tokenVersion,
        role_keys: account.roleKeys,
        created_at: account.createdAt.toISOString(),
        updated_at: account.updatedAt.toISOString(),
      })),
      total: accounts.length,
    },
    200,
  )
})

// @authorization permission iam:write - Company主体を作らずopaque System Accountだけを作る
export const POST = systemFactory.createHandlers(
  authenticateSystemAccessToken,
  requireSystemStepUp,
  async (context) => {
    if (!context.var.permissions.has("system:admin") && !context.var.permissions.has("iam:write")) {
      throw new SystemForbiddenError()
    }

    const now = context.var.now()
    const accountId = zAccountId.safeParse(crypto.randomUUID())
    if (!Number.isSafeInteger(now.getTime()) || !accountId.success) {
      throw new SystemAccountUnavailableError()
    }
    const afterJson = StableSystemAuditJsonValue.create({ status: "active", token_version: 0 })
    if (afterJson instanceof Error) {
      throw new SystemAccountUnavailableError()
    }
    const auditEvent = SystemAuditEventEntity.create({
      actorAccountId: context.var.userId,
      action: SYSTEM_AUDIT_ACTIONS.systemAccountCreated,
      targetType: "system:account",
      targetId: accountId.data,
      outcome: "succeeded",
      reasonCode: null,
      authorizationJson: null,
      beforeJson: null,
      afterJson: afterJson?.toString() ?? null,
      metadataJson: null,
      occurredAt: now,
    })
    if (auditEvent instanceof Error) {
      throw new SystemAccountUnavailableError()
    }
    const auditStatements = new SystemAuditEventRepository({
      env: { DB: context.env.DB },
    }).prepareAppend(auditEvent)
    const repository = new SystemAccountCatalogRepository({ env: { DB: context.env.DB } })
    const creation = await repository.create(accountId.data, now, auditStatements)
    if (creation instanceof Error) {
      throw new SystemAccountUnavailableError()
    }
    if (creation === "conflict") {
      throw new SystemAccountConflictError()
    }

    const account = await repository.find(accountId.data)
    if (account === null || account instanceof Error) {
      throw new SystemAccountUnavailableError()
    }

    return context.json(
      {
        id: account.id,
        status: account.status,
        token_version: account.tokenVersion,
        role_keys: account.roleKeys,
        created_at: account.createdAt.toISOString(),
        updated_at: account.updatedAt.toISOString(),
      },
      201,
    )
  },
)
