import { PasswordResetRequestApplicationError } from "@/contexts/system/application/errors"
import type { PasswordResetEmailAdapter } from "@/contexts/system/infrastructure/adapters/auth/password-reset-email.adapter"
import { hashPasswordResetToken } from "@system/lib/auth/hash-password-reset-token"
import { generateOpaqueToken } from "@system/lib/auth/generate-opaque-token"
import type { CreateSystemPasswordResetChallengeAdapter } from "@system/infrastructure/adapters/auth/create-system-password-reset-challenge.adapter"
import { StableSystemAuditJsonValue } from "@system/domain/values/audit/stable-system-audit-json.value"
import type { SystemRequestAudit } from "@system/configuration/system-context"

type Recipient = Readonly<{
  accountId: string
  identityId: string
  email: string
}>

type Props = Readonly<{
  origin: string
  recipient: Recipient | null
}>

type Context = Readonly<{
  now: () => Date
  auditContext: SystemRequestAudit
  createChallenge: CreateSystemPasswordResetChallengeAdapter["createSystemPasswordResetChallenge"]
  sendEmail: PasswordResetEmailAdapter["send"]
  /** 応答の後も処理を継続させる。受け取るtaskは失敗してもrejectしない。 */
  runAfterResponse: (task: Promise<void>) => void
}>

/**
 * パスワード再設定チャレンジを作成する。
 *
 * Accountの実在を応答時間から推測させないため、チャレンジの保存とメール送信は応答の後に行い、
 * 実在しない宛先と同じ経路で即座に受付結果を返す。
 */
export class CreatePasswordResetChallenge {
  static readonly featureId = "00450024"

  private readonly tokenLifetimeMilliseconds = 60 * 60 * 1000

  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  execute(props: Props): { ok: true } {
    if (props.recipient !== null) {
      this.c.runAfterResponse(this.issueSafely(props.origin, props.recipient))
    }

    return { ok: true as const }
  }

  private async issueSafely(origin: string, recipient: Recipient): Promise<void> {
    try {
      const result = await this.issue(origin, recipient)
      if (result instanceof Error) {
        console.error("[password-reset] failed to issue challenge.", result)
      }
    } catch (cause) {
      console.error(
        "[password-reset] failed to issue challenge.",
        new PasswordResetRequestApplicationError(cause),
      )
    }
  }

  private async issue(origin: string, recipient: Recipient): Promise<void | Error> {
    const now = this.c.now()
    const rawToken = generateOpaqueToken()
    const tokenHash = await hashPasswordResetToken(rawToken)
    if (tokenHash instanceof Error) return new PasswordResetRequestApplicationError(tokenHash)
    const metadataJson = StableSystemAuditJsonValue.create({
      client_ip: this.c.auditContext.clientIp,
      client_name: this.c.auditContext.clientName,
      request_id: this.c.auditContext.requestId,
    })
    if (metadataJson instanceof Error) return new PasswordResetRequestApplicationError(metadataJson)

    const writeResult = await this.c.createChallenge({
      actorAccountId: null,
      id: crypto.randomUUID(),
      tokenHash,
      accountId: recipient.accountId,
      identityId: recipient.identityId,
      createdAt: now,
      expiresAt: new Date(now.getTime() + this.tokenLifetimeMilliseconds),
      metadataJson: metadataJson?.toString() ?? null,
    })
    if (writeResult instanceof Error) return new PasswordResetRequestApplicationError(writeResult)

    const emailResult = await this.c.sendEmail({
      to: recipient.email,
      origin,
      token: rawToken,
    })
    if (emailResult instanceof Error) {
      console.error("[password-reset-email] failed to send.", emailResult)
    }
  }
}
