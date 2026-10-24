import type { SystemDatabase } from "@system/configuration/system-context"
import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import { SystemAccountRepository } from "@system/infrastructure/repositories/auth/system-account.repository"

/** Accountとtoken版の現在状態から、正規のsessionを解決する。 */
export function resolveSystemAccountSession(
  props: Readonly<{
    database: SystemDatabase | D1Database
    accountId: AccountId
    sessionTokenVersion: number
  }>,
) {
  return SystemAccountRepository.resolveSession({
    accountRepository: new SystemAccountRepository({ database: props.database }),
    accountId: props.accountId,
    sessionTokenVersion: props.sessionTokenVersion,
  })
}
