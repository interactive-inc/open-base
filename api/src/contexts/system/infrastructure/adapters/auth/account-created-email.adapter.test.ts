import { expect, test } from "bun:test"
import { AccountCreatedEmailAdapter } from "@/contexts/system/infrastructure/adapters/auth/account-created-email.adapter"

test("buildAccountCreatedEmail: email の HTML 特殊文字をエスケープする ", () => {
  const content = AccountCreatedEmailAdapter.build({
    origin: "https://identity.example.test",
    token: "tok-1",
    email: `"<b>x</b>"@example.test`,
    senderName: "System",
  })

  expect(content.html).toContain("&quot;&lt;b&gt;x&lt;/b&gt;&quot;@example.test")
  expect(content.html).not.toContain("<b>x</b>")
  /**
   * text 版はプレーンテキストなのでエスケープしない。
   */
  expect(content.text).toContain(`"<b>x</b>"@example.test`)
})

test("buildAccountCreatedEmail: 通常のメールアドレスはそのまま埋め込む", () => {
  const content = AccountCreatedEmailAdapter.build({
    origin: "https://identity.example.test",
    token: "tok-2",
    email: "user@example.test",
    senderName: "System",
  })

  expect(content.html).toContain("<strong>user@example.test</strong>")
  expect(content.html).toContain("https://identity.example.test/reset-password?token=tok-2")
})
