import { SYSTEM_AUDIT_ACTIONS } from "@system/domain/catalogs/audit/system-audit-action.catalog"
import {
  OidcInvalidRequestApplicationError,
  OidcInvalidScopeApplicationError,
  OidcTemporarilyUnavailableApplicationError,
} from "@/contexts/system/application/errors"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { SystemAuditEventRepository } from "@system/infrastructure/repositories/audit/system-audit-event.repository"
import { CreateOidcAuthorizationCodeAdapter } from "@system/infrastructure/adapters/identity/create-oidc-authorization-code.adapter"
import type { OidcClientRegistryValue } from "@system/domain/values/oauth/oidc-client-registry.value"
import { OidcScopeValue } from "@system/domain/values/oauth/oidc-scope.value"
import type {
  SystemAuthorizationContext,
  SystemClockContext,
  SystemD1Context,
  SystemDatabaseContext,
} from "@system/configuration/system-context"

type Props = Readonly<{
  issuer: string
  clientId: string
  redirectUri: string
  scope: string
  state: string
  nonce: string
  codeChallenge: string
  clientRegistry: OidcClientRegistryValue
}>

type AuditProps = Readonly<{
  accountId: AccountId
  outcome: "succeeded" | "denied"
  reasonCode: "user_denied" | null
  issuer: string
  clientId: string
  scope: ReadonlyArray<string>
}>
type Context = SystemDatabaseContext &
  SystemD1Context &
  SystemClockContext &
  SystemAuthorizationContext

/** OIDC認可要求を承認する。 */
export class ApproveOidcAuthorization {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(props: Props) {
    const client = props.clientRegistry.resolve({
      issuer: props.issuer,
      clientId: props.clientId,
      redirectUri: props.redirectUri,
    })

    if (client === null) {
      return new OidcInvalidRequestApplicationError()
    }

    const scope = OidcScopeValue.create(props.scope)

    if (scope instanceof Error) {
      return new OidcInvalidScopeApplicationError(scope)
    }

    const accountId = zAccountId.safeParse(this.c.var.userId)

    if (!accountId.success) {
      return new OidcTemporarilyUnavailableApplicationError(accountId.error)
    }

    const redirect = new URL(props.redirectUri)
    redirect.searchParams.set("state", props.state)
    redirect.searchParams.set("iss", props.issuer)

    const authorizationCode = await new CreateOidcAuthorizationCodeAdapter(
      this.c,
    ).createOidcAuthorizationCode({
      issuer: props.issuer,
      clientId: client.id,
      redirectUri: props.redirectUri,
      accountId: accountId.data,
      codeChallenge: props.codeChallenge,
      nonce: props.nonce,
      scope: scope.items,
    })

    if (authorizationCode instanceof Error) {
      return new OidcTemporarilyUnavailableApplicationError(authorizationCode)
    }

    redirect.searchParams.set("code", authorizationCode.code)

    const auditError = await this.recordAudit({
      accountId: accountId.data,
      outcome: "succeeded",
      reasonCode: null,
      issuer: props.issuer,
      clientId: client.id,
      scope: scope.items,
    })

    if (auditError !== null) {
      return new OidcTemporarilyUnavailableApplicationError(auditError)
    }

    return { redirect_uri: redirect.toString() }
  }

  private async recordAudit(props: AuditProps): Promise<Error | null> {
    const audit = SystemAuditEventEntity.createOidc({
      accountId: props.accountId,
      action: SYSTEM_AUDIT_ACTIONS.authOidcAuthorization,
      outcome: props.outcome,
      reasonCode: props.reasonCode,
      authorization: { role: this.c.var.role },
      metadata: {
        issuer: props.issuer,
        clientId: props.clientId,
        scope: props.scope.join(" "),
      },
      occurredAt: this.c.var.now(),
    })

    if (audit instanceof Error) return audit

    const appended = await new SystemAuditEventRepository(this.c).append(audit)

    return appended instanceof Error ? appended : null
  }
}
