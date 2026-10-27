import { EmailValue } from "@system/domain/values/identity/email.value"

/** メール主体をSystemの規則で検証し、正規化した文字列を返す。 */
export function normalizeSystemEmailAddress(input: string) {
  const email = EmailValue.create(input)
  return email instanceof Error ? email : email.toString()
}
