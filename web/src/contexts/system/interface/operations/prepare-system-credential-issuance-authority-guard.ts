import type { SystemDatabase } from "@system/configuration/system-context"
import {
  SystemCredentialIssuanceAuthorityAdapter,
  type SystemCredentialIssuanceAuthorityInput,
} from "@system/infrastructure/adapters/identity/system-credential-issuance-authority.adapter"

/** 保存直前の資格情報発行権限を同じ変更単位で検査する文を返す。 */
export function prepareSystemCredentialIssuanceAuthorityGuard(
  database: SystemDatabase,
  input: SystemCredentialIssuanceAuthorityInput,
) {
  return new SystemCredentialIssuanceAuthorityAdapter(database).prepare(input)
}
