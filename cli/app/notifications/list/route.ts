import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { UsageError } from "@/lib/errors"
import { factory } from "@/factory"

export const help = `base notifications list [--unread]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      unread: z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    const client = await createClient()

    const response = await client.system.notifications.$get({
      query: { read: query.unread ? "false" : undefined },
    })
    if (response.status !== 200) throw new UsageError("通知一覧の取得に失敗しました")

    const rows = await response.json()

    return c.json(rows)
  },
)
