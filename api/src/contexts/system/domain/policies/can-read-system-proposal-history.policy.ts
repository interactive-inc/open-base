import { SystemFeaturePermission } from "@system/domain/catalogs/iam/system-feature-permission.catalog"

/** 提案の履歴は明示的な閲覧権限と申請・判断の関係から開示する。 */
export function canReadSystemProposalHistory(
  input: Readonly<{
    permissionKeys: ReadonlySet<string>
    accountId: string
    createdByAccountId: string
    attestations: ReadonlyArray<Readonly<{ actorAccountId: string; representedAccountId: string }>>
  }>,
): boolean {
  if (!input.permissionKeys.has(SystemFeaturePermission.PROCEDURE_READ.key)) return false
  if (input.permissionKeys.has(SystemFeaturePermission.PROCEDURE_READ_ALL.key)) return true
  if (input.accountId === input.createdByAccountId) return true
  return input.attestations.some(
    (attestation) =>
      attestation.actorAccountId === input.accountId ||
      attestation.representedAccountId === input.accountId,
  )
}
