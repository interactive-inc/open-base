import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"
import { decisionPageGuide } from "@/lib/decision-page-url"

export const help = `base application-requests decide <id>

申請の判断の画面のURLを表示します。承認・却下・差し戻しはブラウザーで人が行い、CLIからは記録しません。`

export default factory.createHandlers(
  zValidator("json", z.object({ help: z.string().optional() }).strict()),
  zValidator("param", z.object({ app_id: z.string().optional() })),
  (c) => {
    if (c.req.valid("json").help) return c.text(help)

    const appId = c.req.valid("param").app_id

    if (!appId) throw new UsageError("引数 <id> が必要です")
    // 画面と同じく、申請番号は正の整数だけを受け付ける。
    if (!/^[1-9]\d{0,15}$/.test(appId)) throw new UsageError("申請番号を指定してください")

    return c.text(decisionPageGuide("application", appId))
  },
)
