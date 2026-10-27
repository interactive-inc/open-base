import type { SystemD1Context } from "@system/configuration/system-context"
import { EmailValue } from "@system/domain/values/identity/email.value"
import { identitySubjectSchema } from "@system/domain/schemas/identity/identity-subject.schema"
import { SystemPasswordCredentialAdapter } from "@system/infrastructure/adapters/auth/system-password-credential.adapter"

/** 認証基盤へ同期する、有効なパスワード資格情報を読む。HTTP応答へは返さない。 */
export async function findSystemPasswordSignInAccount(
  context: SystemD1Context,
  input: Readonly<{ email: string; now: Date }>,
) {
  const email = EmailValue.create(input.email)
  if (email instanceof Error) return null
  if (!Number.isSafeInteger(input.now.getTime())) return new Error("invalid authentication time")
  const subject = identitySubjectSchema.safeParse(email.toString())
  if (!subject.success) return null
  const credential = await new SystemPasswordCredentialAdapter({
    database: context.env.DB,
  }).findBySubject(subject.data)
  if (credential instanceof Error || credential === null) return credential
  if (credential.account.status !== "active" || !credential.identity.wasActiveAt(input.now))
    return null
  return Object.freeze({
    accountId: credential.account.id,
    email: email.toString(),
    passwordHash: credential.passwordHash,
  })
}
