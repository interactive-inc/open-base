import type { SystemD1Context } from "@system/configuration/system-context"
import type { SystemReadAuthentication } from "@system/domain/definitions/system-read-authentication.definition"
import { PrepareSystemReadAuthorizationAdapter } from "@system/infrastructure/adapters/iam/prepare-system-read-authorization.adapter"
import { SystemFeaturePermission } from "@system/domain/catalogs/iam/system-feature-permission.catalog"

/** 実行者の発行元と保全の操作権限を検査する。会社上の承認と移管元へのアクセス権は別途要求する。 */
export async function preparePreservedRecordWriteAuthorization(
  context: SystemD1Context,
  input: Readonly<{ authentication: SystemReadAuthentication; at: Date }>,
) {
  const proof = await new PrepareSystemReadAuthorizationAdapter(context).prepare(
    input.authentication,
    input.at,
  )
  if (proof instanceof Error || proof === null) return proof
  if (!proof.permissionKeys.has(SystemFeaturePermission.RECORD_PRESERVE.key)) return null
  return proof
}
