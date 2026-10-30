import type {
  SystemAuthorizationContext,
  SystemD1Context,
} from "@system/configuration/system-context"
import { prepareSystemBearerAuthorization } from "@system/interface/authorization/prepare-system-bearer-authorization"
import { SystemPrincipalSecretService } from "@system/lib/auth/system-principal-secret-service"

/** Systemの変更を現在のBearer・対象資源の権限・利用済み再認証grantへ束縛する。 */
export async function prepareSystemWriteAuthorization(
  context: SystemD1Context & SystemAuthorizationContext,
  input: Parameters<typeof prepareSystemBearerAuthorization>[1] & Readonly<{ stepUpToken: string }>,
): Promise<ReadonlyArray<D1PreparedStatement> | "forbidden" | Error> {
  const authentication = context.var.bearerReadAuthentication
  if (authentication === undefined || !/^[0-9a-f]{64}$/.test(input.stepUpToken)) return "forbidden"
  const now = new Date(Math.max(input.now.getTime(), Date.now()))
  const assertions = await prepareSystemBearerAuthorization(context, input)
  if (assertions === "forbidden" || assertions instanceof Error) return assertions
  const hash = await new SystemPrincipalSecretService().hashRawSecret(input.stepUpToken)
  if (hash instanceof Error) return hash
  return [
    ...assertions,
    context.env.DB.prepare(`WITH evaluation AS (
    SELECT max(?3, CAST((julianday('now')-2440587.5)*86400000 AS INTEGER)) AS at
  ) SELECT CASE WHEN EXISTS (
    SELECT 1 FROM system_step_up_grants WHERE account_id=?1 AND token_hash=?2
      AND issued_at <= (SELECT at FROM evaluation) AND expires_at > (SELECT at FROM evaluation)
      AND revoked_at IS NULL AND last_used_at IS NOT NULL AND last_used_at <= (SELECT at FROM evaluation)
  ) THEN 1 ELSE json_extract('{}','system_read_authorization_changed') END`).bind(
      authentication.accountId,
      hash,
      now.getTime(),
    ),
  ]
}
