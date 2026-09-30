import type { AccountStatus } from "@system/domain/schemas/iam/account-status.schema"

export type AccountSessionRejection =
  | "account_inactive"
  | "invalid_account_token_version"
  | "invalid_session_token_version"
  | "token_version_mismatch"

type Props = Readonly<{
  accountStatus: AccountStatus
  accountTokenVersion: number
  sessionTokenVersion: number
}>

/** Accountの現在状態だけでSessionを継続できるかfail-closedで判定する。 */
export function getAccountSessionRejection(props: Props): AccountSessionRejection | null {
  if (props.accountStatus !== "active") {
    return "account_inactive"
  }

  if (Number.isSafeInteger(props.accountTokenVersion) === false || props.accountTokenVersion < 0) {
    return "invalid_account_token_version"
  }

  if (Number.isSafeInteger(props.sessionTokenVersion) === false || props.sessionTokenVersion < 0) {
    return "invalid_session_token_version"
  }

  return props.accountTokenVersion === props.sessionTokenVersion ? null : "token_version_mismatch"
}
