import type { SystemTotpCredentialEntity } from "@system/domain/entities/system-totp-credential.entity"
import { hashSystemTotpRecoveryCode } from "@system/lib/auth/hash-system-totp-recovery-code"
import { normalizeSystemTotpRecoveryCode } from "@system/lib/auth/normalize-system-totp-recovery-code"
import { decryptSystemTotpSecret } from "@system/lib/auth/decrypt-system-totp-secret"
import { verifySystemTotpCode } from "@system/lib/auth/verify-system-totp-code"

export type SystemTotpFactorMethod = "totp" | "recovery_code"

/** 登録済みの二段階認証を変える操作（無効化・復旧コードの作り直し）で、本人確認が通らなかった理由。 */
export type SystemTotpChangeRejection = Readonly<{
  kind: "rejected"
  reason: "not_enabled" | "invalid_code" | "rate_limited"
}>

export type SystemTotpFactorMatch = Readonly<{
  kind: "matched"
  method: SystemTotpFactorMethod
  /** 使ったコードの区間、または使った復旧コードを反映した登録。保存は呼び出し側が行う。 */
  credential: SystemTotpCredentialEntity
}>

/**
 * 有効な登録に対して、入力をワンタイムコード（6桁の数字）か復旧コードとして照合する。
 * 一致しなければ null を返す。使い回しを止めるため、一致したときは使った分を反映した登録を返す。
 */
export async function matchSystemTotpFactor(
  input: Readonly<{
    credential: SystemTotpCredentialEntity
    code: string
    keyMaterial: string
    now: Date
  }>,
): Promise<SystemTotpFactorMatch | null | Error> {
  const credential = input.credential
  if (!credential.isActive) return null

  const compact = input.code.replace(/\s/g, "")

  if (/^\d+$/.test(compact)) {
    const secret = await decryptSystemTotpSecret(credential, input.keyMaterial)
    if (secret instanceof Error) return secret

    const matched = await verifySystemTotpCode({
      secret,
      code: compact,
      now: input.now,
      lastUsedStep: credential.lastUsedStep,
    })
    if (matched === null || matched instanceof Error) return matched

    const used = credential.useStep(matched.step, input.now)
    if (used instanceof Error) return used

    return Object.freeze({ kind: "matched", method: "totp", credential: used })
  }

  if (normalizeSystemTotpRecoveryCode(compact) === null) return null

  const hash = await hashSystemTotpRecoveryCode(compact)
  if (hash instanceof Error) return hash
  if (!credential.recoveryCodeHashes.includes(hash)) return null

  const consumed = credential.consumeRecoveryCode(hash, input.now)
  if (consumed instanceof Error) return consumed

  return Object.freeze({ kind: "matched", method: "recovery_code", credential: consumed })
}
