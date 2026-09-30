import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `base notifications delete --id <notification-id>`

export default factory.createHandlers(
  zValidator("json", z.object({ help: z.string().optional(), id: z.string().optional() })),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    if (!query.id) throw new UsageError("--id が必要です")

    const client = await createClient()

    const response = await client.system.notifications[":id"].$delete({
      param: { id: query.id },
    })

    if (response.status !== 204) {
      throw new UsageError("通知の削除に失敗しました")
    }

    return c.json({ id: query.id, status: "deleted" })
  },
)
