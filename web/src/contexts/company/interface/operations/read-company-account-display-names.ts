import { ReadCompanyAccountDisplayNamesAdapter } from "@/contexts/company/infrastructure/adapters/account-profile/read-company-account-display-names.adapter"

/** Account ID に対応する会社の表示名を、参照可能な組織の同一時点で読む公開境界。 */
export function readCompanyAccountDisplayNames(
  input: ConstructorParameters<typeof ReadCompanyAccountDisplayNamesAdapter>[0],
): Promise<ReadonlyMap<string, string>> {
  return new ReadCompanyAccountDisplayNamesAdapter(input).readCompanyAccountDisplayNames()
}
