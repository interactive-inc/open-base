import type { SystemEmailContext } from "@system/configuration/system-context"
import { escapeHtml } from "@/lib/text/escape-html"

type BuildProps = Readonly<{ origin: string; token: string; email: string; senderName: string }>
type SendProps = Readonly<{ to: string; origin: string; token: string }>

export type AccountCreatedEmailContent = Readonly<{
  subject: string
  text: string
  html: string
}>
type Context = SystemEmailContext

export class AccountCreatedEmailAdapter {
  constructor(private readonly c: Context) {}

  static build(props: BuildProps): AccountCreatedEmailContent {
    const setPasswordLink = `${props.origin}/reset-password?token=${props.token}`
    const loginLink = `${props.origin}/login`
    const subject = `【${props.senderName}】アカウント作成のご案内`
    const text = `${props.senderName} のアカウントが作成されました。

ログイン ID (メールアドレス): ${props.email}

以下のリンクからパスワードを設定するとログインできます。

${setPasswordLink}

設定後のログインはこちら: ${loginLink}

このリンクは一定期間で有効期限が切れます。期限が切れた場合はログイン画面の「パスワードをお忘れですか？」から再発行できます。`
    const html = `<p>${escapeHtml(props.senderName)} のアカウントが作成されました。</p>
<p>ログイン ID (メールアドレス): <strong>${escapeHtml(props.email)}</strong></p>
<p>以下のリンクからパスワードを設定するとログインできます。</p>
<p><a href="${setPasswordLink}">${setPasswordLink}</a></p>
<p>設定後のログインはこちら: <a href="${loginLink}">${loginLink}</a></p>
<p>このリンクは一定期間で有効期限が切れます。期限が切れた場合はログイン画面の「パスワードをお忘れですか？」から再発行できます。</p>`

    return { subject, text, html }
  }

  async send(props: SendProps): Promise<"sent" | "skipped" | Error> {
    const senderName = this.c.env.EMAIL_SENDER_NAME ?? ""
    const content = AccountCreatedEmailAdapter.build({
      origin: props.origin,
      token: props.token,
      email: props.to,
      senderName,
    })

    if (this.c.env.INVITE_EMAIL_SEND_ENABLED !== "true") {
      console.log(`[account-created-email] skipped (local dev). to=${props.to}`)
      return "skipped"
    }

    if (this.c.env.EMAIL === undefined || this.c.env.INVITE_EMAIL_FROM === undefined) {
      return new Error("account_created_email_configuration_missing")
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
      return cause instanceof Error ? cause : new Error("account_created_email_send_failed")
    }
  }
}
