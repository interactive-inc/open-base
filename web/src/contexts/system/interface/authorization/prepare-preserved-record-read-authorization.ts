import type { SystemD1Context } from "@system/configuration/system-context"
import type { SystemReadAuthentication } from "@system/domain/definitions/system-read-authentication.definition"
import { PrepareSystemReadAuthorizationAdapter } from "@system/infrastructure/adapters/iam/prepare-system-read-authorization.adapter"
import { SystemFeaturePermission } from "@system/domain/catalogs/iam/system-feature-permission.catalog"

/** 保全記録の個別開示設定とは別に、現在の発行元と参照・出力の操作権限を検査する。 */
export async function preparePreservedRecordReadAuthorization(
  context: SystemD1Context,
  input: Readonly<{
    authentication: SystemReadAuthentication
    action: "read" | "export"
    at: Date
  }>,
) {
  const proof = await new PrepareSystemReadAuthorizationAdapter(context).prepare(
    input.authentication,
    input.at,
  )
  if (proof instanceof Error || proof === null) return proof
  const required =
    input.action === "read"
      ? SystemFeaturePermission.RECORD_READ
      : SystemFeaturePermission.RECORD_EXPORT
  if (!proof.permissionKeys.has(required.key)) return null
  return proof
}
