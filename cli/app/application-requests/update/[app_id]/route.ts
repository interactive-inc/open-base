import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `base application-requests update <id> --payload <json>`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({ help: z.string().optional(), payload: z.string().optional() }).passthrough(),
  ),
  zValidator("param", z.object({ app_id: z.string().optional() })),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    const appId = c.req.valid("param").app_id

    if (!appId) throw new UsageError("引数 <id> が必要です")

    if (!query.payload) throw new UsageError("--payload が必要です")

    const payload = toPayload(query.payload)

    if (payload instanceof Error) throw new UsageError("--payload は JSON で指定してください")

    const client = await createClient()

    const response = await client["company"]["application-requests"][":id"].$put({
      param: { id: appId },
      json: { payload: payload },
    })

    const application = await response.json()

    return c.json(application)
  },
)

/** --payload の文字列を JSON へ。解析できなければ Error。 */
function toPayload(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch (error) {
    return error instanceof Error ? error : new Error("invalid payload json")
  }
}
