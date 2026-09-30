import type { SystemReadAuthentication } from "@system/domain/definitions/system-read-authentication.definition"
import { PrepareSystemReadAuthorizationAdapter } from "@system/infrastructure/adapters/iam/prepare-system-read-authorization.adapter"

/** 現在のBearer発行元とglobal権限を読み、開示の前後で同じ資格を要求する文の生成器を返す。 */
export function prepareSystemReadAuthorization(
  input: Readonly<{
    database: D1Database
    authentication: SystemReadAuthentication
    at: Date
  }>,
) {
  return new PrepareSystemReadAuthorizationAdapter({ env: { DB: input.database } }).prepare(
    input.authentication,
    input.at,
  )
}
