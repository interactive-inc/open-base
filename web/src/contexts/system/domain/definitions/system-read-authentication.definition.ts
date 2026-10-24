import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"

/** 検証済みBearerの発行元と期限。値の取得元で署名・issuer・audienceを検証する。 */
export type SystemReadAuthentication = Readonly<{
  accountId: AccountId
  tokenVersion: number
  issuedAtMs: number
  expiresAtMs: number
  machineCredentialId: string | null
  identityBindingId: string | null
}>
