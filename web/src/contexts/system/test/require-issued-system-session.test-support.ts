import type { IssueSystemSessionResult } from "@system/domain/definitions/auth/system-session-issuance.definition"

type IssuedSystemSession = Extract<IssueSystemSessionResult, { kind: "issued" }>

/**
 * 正常系の準備で発行したSystem Sessionを取り出す。
 * 拒否は通常の結果でありErrorではないため、ここで失敗させないと後続の検証を行わないままテストが通る。
 */
export function requireIssuedSystemSession(
  issuance: IssueSystemSessionResult | Error,
): IssuedSystemSession {
  if (issuance instanceof Error) {
    throw new Error("System Session issuance failed", { cause: issuance })
  }

  if (issuance.kind === "rejected") {
    throw new Error(`System Session issuance was rejected: ${issuance.reason}`)
  }

  return issuance
}
