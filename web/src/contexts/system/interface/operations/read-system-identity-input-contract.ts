import { zIdentityId } from "@system/domain/schemas/identity/identity-id.schema"
import { identitySubjectSchema } from "@system/domain/schemas/identity/identity-subject.schema"
import { identityProviderSchema } from "@system/domain/schemas/identity/identity-provider.schema"
import { EmailValue } from "@system/domain/values/identity/email.value"

const contract = Object.freeze({
  id: zIdentityId,
  subject: identitySubjectSchema,
  provider: identityProviderSchema,
  email: EmailValue.schema,
})

/** Identityの識別子と連絡先を境界で検証するための公開contract。 */
export function readSystemIdentityInputContract() {
  return contract
}
