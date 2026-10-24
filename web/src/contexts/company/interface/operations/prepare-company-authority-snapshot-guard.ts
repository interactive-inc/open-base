import { CompanyAuthoritySnapshotGuardAdapter } from "@/contexts/company/infrastructure/adapters/organization/company-authority-snapshot-guard.adapter"

/** 読み取った Account 対応と従業員 code が確定まで変わらないことを検査する文を返す公開境界。 */
export function prepareCompanyAuthoritySnapshotGuard(
  c: ConstructorParameters<typeof CompanyAuthoritySnapshotGuardAdapter>[0],
  input: Parameters<CompanyAuthoritySnapshotGuardAdapter["prepare"]>[0],
): ReturnType<CompanyAuthoritySnapshotGuardAdapter["prepare"]> {
  return new CompanyAuthoritySnapshotGuardAdapter(c).prepare(input)
}
