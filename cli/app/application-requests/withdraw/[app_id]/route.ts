import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `base application-requests withdraw <id>`

export default factory.createHandlers(
  zValidator("json", z.object({ help: z.string().optional() }).passthrough()),
  zValidator("param", z.object({ app_id: z.string().optional() })),
  async (c) => {
    if (c.req.valid("json").help) return c.text(help)

    const appId = c.req.valid("param").app_id

    if (!appId) throw new UsageError("引数 <id> が必要です")

    const client = await createClient()

    const response = await client["company"]["application-requests"][":id"].$delete({
      param: { id: appId },
    })

    if (response.status !== 204) {
      throw new UsageError("申請の取り下げに失敗しました")
    }

    return c.json({ id: appId, status: "withdrawn" })
  },
)
