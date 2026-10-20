import type { SystemDatabase } from "@system/configuration/system-context"
import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import {
  SystemPasswordCredentialAdapter,
  type SystemPasswordMaterialService,
} from "@system/infrastructure/adapters/auth/system-password-credential.adapter"
import { decoySystemPasswordHash } from "@system/lib/auth/decoy-system-password-hash"
import { passwordHashNeedsRehash } from "@system/lib/auth/password-hash-needs-rehash"

/**
 * 認証済みAccountのpasswordを、そのAccountの有効なpassword credentialのどれかと照合する。
 * 認証できた場合は一致したIdentityを返す。
 */
export function authenticateSystemAccountPassword(
  database: SystemDatabase,
  command: Readonly<{ accountId: AccountId; password: string; now: Date }>,
  verify: SystemPasswordMaterialService["verify"],
) {
  return new SystemPasswordCredentialAdapter({ database }).authenticateAccount(command, {
    dummyHash: decoySystemPasswordHash,
    needsRehash: (passwordHash) => passwordHashNeedsRehash(passwordHash),
    verify,
  })
}
