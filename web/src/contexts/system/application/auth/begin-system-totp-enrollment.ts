import type { SystemClockContext, SystemD1Context } from "@system/configuration/system-context"
import { SystemTotpCredentialEntity } from "@system/domain/entities/system-totp-credential.entity"
import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import { SystemTotpCredentialRepository } from "@system/infrastructure/repositories/auth/system-totp-credential.repository"
import { SystemTotpSecretCipher } from "@system/lib/auth/system-totp-secret-cipher"
import { buildSystemTotpKeyUri } from "@system/lib/auth/build-system-totp-key-uri"
import { generateSystemTotpSecret } from "@system/lib/auth/generate-system-totp-secret"

type Context = SystemD1Context & SystemClockContext

type Props = Readonly<{
  accountId: AccountId
  /** 秘密鍵を暗号化する鍵の素材。製品が secret から渡し、System は保存しない。 */
  keyMaterial: string
  issuer: string
  accountName: string
}>

export type SystemTotpEnrollment = Readonly<{ secret: string; keyUri: string }>

export type SystemTotpEnrollmentRejection = Readonly<{
  kind: "rejected"
  reason: "already_enabled"
}>

/**
 * 認証アプリへの登録を始める。新しい秘密鍵を作って `pending` で保存し、認証アプリへ渡す
 * 秘密鍵と URI を一度だけ返す。有効な登録があるときは上書きしない（無効化してからやり直す）。
 */
export class BeginSystemTotpEnrollment {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(
    props: Props,
  ): Promise<SystemTotpEnrollment | SystemTotpEnrollmentRejection | Error> {
    const now = this.c.var.now()
    if (!Number.isSafeInteger(now.getTime())) return new Error("System clock is invalid")

    const repository = new SystemTotpCredentialRepository(this.c)
    const current = await repository.find(props.accountId)
    if (current instanceof Error) return current
    if (current?.isActive === true) {
      return Object.freeze({ kind: "rejected" as const, reason: "already_enabled" as const })
    }

    const cipher = await SystemTotpSecretCipher.open(props.keyMaterial)
    if (cipher instanceof Error) return cipher

    const secret = generateSystemTotpSecret()
    const secretCiphertext = await cipher.encrypt(secret, props.accountId)
    if (secretCiphertext instanceof Error) return secretCiphertext

    const credential = SystemTotpCredentialEntity.begin({
      accountId: props.accountId,
      secretCiphertext,
      now,
    })
    if (credential instanceof Error) return credential

    const written = await repository.write({ kind: "begin", credential }, [])
    if (written instanceof Error) return written
    if (written === "conflict") {
      return Object.freeze({ kind: "rejected" as const, reason: "already_enabled" as const })
    }

    return Object.freeze({
      secret,
      keyUri: buildSystemTotpKeyUri({
        secret,
        issuer: props.issuer,
        accountName: props.accountName,
      }),
    })
  }
}
