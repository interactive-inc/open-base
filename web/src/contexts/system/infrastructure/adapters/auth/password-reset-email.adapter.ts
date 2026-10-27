import type { SystemEmailContext } from "@system/configuration/system-context"

type BuildProps = Readonly<{ origin: string; token: string; senderName: string }>
type SendProps = Readonly<{ origin: string; token: string; to: string }>

export type PasswordResetEmailContent = Readonly<{ subject: string; text: string; html: string }>
type Context = SystemEmailContext

export class PasswordResetEmailAdapter {
  constructor(private readonly c: Context) {}

  static build(props: BuildProps): PasswordResetEmailContent {
    const link = `${props.origin}/reset-password?token=${props.token}`
    const subject = `【${props.senderName}】パスワード再設定のご案内`
    const text = `パスワード再設定のリクエストを受け付けました。

以下のリンクから新しいパスワードを設定してください。

${link}

このリンクは一定期間で有効期限が切れます。心当たりがない場合はこのメールを破棄してください。`
    const html = `<p>パスワード再設定のリクエストを受け付けました。</p>
<p>以下のリンクから新しいパスワードを設定してください。</p>
<p><a href="${link}">${link}</a></p>
<p>このリンクは一定期間で有効期限が切れます。心当たりがない場合はこのメールを破棄してください。</p>`

    return { subject, text, html }
  }

  async send(props: SendProps): Promise<"sent" | "skipped" | Error> {
    const senderName = this.c.env.EMAIL_SENDER_NAME ?? ""
    const content = PasswordResetEmailAdapter.build({
      ...props,
      senderName,
    })

    if (this.c.env.INVITE_EMAIL_SEND_ENABLED !== "true") {
      console.log(`[password-reset-email] skipped (local dev). to=${props.to}`)
      return "skipped"
    }

    if (this.c.env.EMAIL === undefined || this.c.env.INVITE_EMAIL_FROM === undefined) {
      return new Error("password_reset_email_configuration_missing")
    }

    try {
      await this.c.env.EMAIL.send({
        to: props.to,
        from: { name: senderName, email: this.c.env.INVITE_EMAIL_FROM },
        subject: content.subject,
        text: content.text,
        html: content.html,
      })
      return "sent"
    } catch (cause) {
      return cause instanceof Error ? cause : new Error("password_reset_email_send_failed")
    }
  }
}
