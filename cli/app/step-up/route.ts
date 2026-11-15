import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { factory } from "@/factory"
import { ApiError, UsageError } from "@/lib/errors"
import { api } from "@/lib/http/client"
import { readSecretStdin } from "@/lib/input/read-secret-stdin"

export const help = `base step-up — 高リスク操作の直前の本人確認（5分で失効）

usage:
  base step-up --password-stdin
      パスワードを標準入力から渡して再認証する
  base step-up --external-identity-token-stdin
      IdPで取り直したIDトークンを標準入力から渡して再認証する

標準出力にはトークンだけを出します。他のコマンドの --step-up に渡してください。
  token=$(base step-up --password-stdin) && base roles delete <role-id> --step-up "$token"
デバイス認証のセッション自体は再認証の証拠になりません。`

const grantResponse = z.object({ step_up_token: z.string().regex(/^[0-9a-f]{64}$/) })

export default factory.createHandlers(
  zValidator(
    "json",
    z.strictObject({
      help: z.string().optional(),
      "password-stdin": z.string().optional(),
      "external-identity-token-stdin": z.string().optional(),
    }),
  ),
  async (c) => {
    const flags = c.req.valid("json")
    if (flags.help !== undefined) return c.text(help)

    const hasPassword = flags["password-stdin"] !== undefined
    if (hasPassword === (flags["external-identity-token-stdin"] !== undefined))
      throw new UsageError(
        "--password-stdin か --external-identity-token-stdin のどちらか一つを指定してください",
      )

    const secret = await readSecretStdin()
    const json = hasPassword
      ? { method: "password", password: secret }
      : { method: "external_identity", token: secret }

    const grant = grantResponse.safeParse(
      await api("/system/step-up-grants", { method: "POST", json }),
    )
    if (!grant.success) throw new ApiError(502, "再認証の応答を解釈できません")

    return c.text(grant.data.step_up_token)
  },
)
