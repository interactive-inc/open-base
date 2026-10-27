import type {
  SystemClockContext,
  SystemD1Context,
  SystemDatabaseContext,
} from "@system/configuration/system-context"
import { matchSystemTotpFactor } from "@system/lib/auth/match-system-totp-factor"
import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import { LoginRateLimitAdapter } from "@system/infrastructure/adapters/auth/login-rate-limit.adapter"
import { SystemTotpCredentialRepository } from "@system/infrastructure/repositories/auth/system-totp-credential.repository"

type Context = SystemD1Context & SystemDatabaseContext & SystemClockContext

type Props = Readonly<{ accountId: AccountId; code: string | null; keyMaterial: string }>

export type SystemTotpFactorVerification =
  | Readonly<{ kind: "not_enabled" }>
  | Readonly<{ kind: "verified"; method: "totp" | "recovery_code" }>
  | Readonly<{ kind: "rejected"; reason: "code_required" | "invalid_code" | "rate_limited" }>

/**
 * パスワードを確かめた後、challenge を挟まずに同じ request で二段階目を確かめる。
 * 二段階認証が無効な Account は `not_enabled` を返し、呼び出し側はパスワードだけで進めてよい。
 * 一致したコードは使用済みとして保存し、同じコードを使い回せないようにする。
 */
export class VerifySystemTotpFactor {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(props: Props): Promise<SystemTotpFactorVerification | Error> {
    const now = this.c.var.now()
    if (!Number.isSafeInteger(now.getTime())) return new Error("System clock is invalid")

    const repository = new SystemTotpCredentialRepository(this.c)
    const credential = await repository.find(props.accountId)
    if (credential instanceof Error) return credential
    if (credential === null || !credential.isActive)
      return Object.freeze({ kind: "not_enabled" as const })
    if (props.code === null) {
      return Object.freeze({ kind: "rejected" as const, reason: "code_required" as const })
    }

    const rateLimit = new LoginRateLimitAdapter(this.c)
    const gate = await rateLimit.recordAndCheckSecondFactor({ accountId: props.accountId })
    if (gate.limited) {
      return Object.freeze({ kind: "rejected" as const, reason: "rate_limited" as const })
    }

    const matched = await matchSystemTotpFactor({
      credential,
      code: props.code,
      keyMaterial: props.keyMaterial,
      now,
    })
    if (matched instanceof Error) return matched
    if (matched === null) {
      return Object.freeze({ kind: "rejected" as const, reason: "invalid_code" as const })
    }

    const written = await repository.write(
      { kind: "update", previous: credential, credential: matched.credential },
      [],
    )
    if (written instanceof Error) return written
    if (written === "conflict") {
      return Object.freeze({ kind: "rejected" as const, reason: "invalid_code" as const })
    }

    await rateLimit.resetSecondFactor({ accountId: props.accountId })

    return Object.freeze({ kind: "verified" as const, method: matched.method })
  }
}
