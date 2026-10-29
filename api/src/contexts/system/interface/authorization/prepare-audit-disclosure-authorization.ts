import type {
  SystemD1Context,
  SystemAuthorizationContext,
} from "@system/configuration/system-context"
import { prepareSystemHumanBearerAuthorization } from "@system/interface/authorization/prepare-system-human-bearer-authorization"
import { SystemPrincipalSecretService } from "@system/lib/auth/system-principal-secret-service"

/** 開示設定の管理は現在の人の管理権限を要求し、変更時は再認証も固定する。 */
export async function prepareAuditDisclosureAuthorization(
  context: SystemD1Context & SystemAuthorizationContext,
  input: Readonly<{ now: Date; stepUpToken: string | null }>,
) {
  const proof = await prepareSystemHumanBearerAuthorization(context, {
    permissions: ["system:admin"],
    now: input.now,
  })
  if (proof instanceof Error || proof === "forbidden") return proof
  if (input.stepUpToken === null) return proof.assertions
  const hash = await new SystemPrincipalSecretService().hashRawSecret(input.stepUpToken)
  if (hash instanceof Error) return hash
  return [
    ...proof.assertions,
    context.env.DB.prepare(`WITH evaluation AS (
      SELECT max(?3, CAST((julianday('now')-2440587.5)*86400000 AS INTEGER)) AS at
    ) SELECT CASE WHEN EXISTS (
    SELECT 1 FROM system_step_up_grants WHERE account_id = ?1 AND token_hash = ?2
      AND issued_at <= (SELECT at FROM evaluation) AND expires_at > (SELECT at FROM evaluation)
      AND revoked_at IS NULL AND last_used_at <= (SELECT at FROM evaluation)
    ) THEN 1 ELSE json_extract('{}', 'system_human_authorization_changed') END`).bind(
      context.var.userId,
      hash,
      input.now.getTime(),
    ),
  ]
}
