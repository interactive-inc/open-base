import type {
  SystemD1Context,
  SystemAuthorizationContext,
} from "@system/configuration/system-context"
import { SystemHumanOperationAuthorizationAdapter } from "@system/infrastructure/adapters/iam/system-human-operation-authorization.adapter"
import { SystemPrincipalSecretService } from "@system/lib/auth/system-principal-secret-service"

/** 保全の参照・変更に必要な人の権限と再認証をtransactionでも照合する。 */
export async function prepareAttachmentPreservationAuthorization(
  context: SystemD1Context & SystemAuthorizationContext,
  input: Readonly<{ now: Date; stepUpToken: string | null }>,
): Promise<ReadonlyArray<D1PreparedStatement> | "forbidden" | Error> {
  const proof = await new SystemHumanOperationAuthorizationAdapter(context).prepare({
    accountId: context.var.userId,
    tokenVersion: context.var.accountTokenVersion,
    permissions: ["system:admin"],
    now: input.now,
  })
  if (proof instanceof Error || proof === "forbidden") return proof
  if (input.stepUpToken === null) return proof.assertions
  const hash = await new SystemPrincipalSecretService().hashRawSecret(input.stepUpToken)
  if (hash instanceof Error) return hash
  return [
    ...proof.assertions,
    context.env.DB.prepare(`SELECT CASE WHEN EXISTS (
    SELECT 1 FROM system_step_up_grants WHERE account_id = ?1 AND token_hash = ?2
      AND issued_at <= ?3 AND expires_at > ?3 AND revoked_at IS NULL AND last_used_at <= ?3
  ) THEN 1 ELSE json_extract('{}', 'system_human_authorization_changed') END`).bind(
      context.var.userId,
      hash,
      input.now.getTime(),
    ),
  ]
}
