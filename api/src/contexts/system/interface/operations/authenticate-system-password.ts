import type { SystemDatabase } from "@system/configuration/system-context"
import type { IdentitySubject } from "@system/domain/schemas/identity/identity-subject.schema"
import {
  SystemPasswordCredentialAdapter,
  type SystemPasswordMaterialService,
} from "@system/infrastructure/adapters/auth/system-password-credential.adapter"

/** Identityのpasswordを現在のcredentialと照合する。 */
export function authenticateSystemPassword(
  database: SystemDatabase,
  command: Readonly<{ subject: IdentitySubject; password: string; now: Date }>,
  passwordMaterialService: SystemPasswordMaterialService,
) {
  return new SystemPasswordCredentialAdapter({ database }).authenticate(
    command,
    passwordMaterialService,
  )
}
