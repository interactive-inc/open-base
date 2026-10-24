import { PreservedRecordDisclosurePolicyRepository } from "@system/infrastructure/repositories/records/preserved-record-disclosure-policy.repository"

/** 保全記録の開示設定と監査を同時に扱う保存口を開く。 */
export function openSystemPreservedRecordDisclosurePolicies(
  context: ConstructorParameters<typeof PreservedRecordDisclosurePolicyRepository>[0],
): PreservedRecordDisclosurePolicyRepository {
  return new PreservedRecordDisclosurePolicyRepository(context)
}
