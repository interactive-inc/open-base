import { IssuedEmailValue } from "@system/domain/values/identity/issued-email.value"

/** Systemが所有する値を検証・生成する。 */
export function createSystemIssuedEmail(...input: Parameters<typeof IssuedEmailValue.create>) {
  return IssuedEmailValue.create(...input)
}
