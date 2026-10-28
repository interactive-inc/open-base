import type { SystemDatabase } from "@system/configuration/system-context"
import {
  SystemCredentialIssuanceAuthorityAdapter,
  type SystemCredentialIssuanceAuthorityInput,
} from "@system/infrastructure/adapters/identity/system-credential-issuance-authority.adapter"

/** 対象として認証できる資格の発行を、現在の保存済み権限で判定する。評価不能なら例外を返す。 */
export function canIssueSystemCredentials(
  database: SystemDatabase | D1Database,
  input: SystemCredentialIssuanceAuthorityInput,
) {
  return new SystemCredentialIssuanceAuthorityAdapter(database).canIssue(input)
}
