import { SYSTEM_AUDIT_ACTIONS } from "@system/domain/catalogs/audit/system-audit-action.catalog"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"

/** OIDC の認可コードを token に交換できた事実を、交換した本人のアカウントの監査として作る。 */
export function createSystemOidcTokenExchangeAuditEvent(
  input: Readonly<{
    accountId: AccountId
    issuer: string
    clientId: string
    scope: string
    occurredAt: Date
  }>,
) {
  return SystemAuditEventEntity.createOidc({
    accountId: input.accountId,
    action: SYSTEM_AUDIT_ACTIONS.authOidcTokenExchange,
    outcome: "succeeded",
    reasonCode: null,
    authorization: null,
    metadata: { issuer: input.issuer, clientId: input.clientId, scope: input.scope },
    occurredAt: input.occurredAt,
  })
}
