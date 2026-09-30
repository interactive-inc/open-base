import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `base notifications read <id>`

export default factory.createHandlers(
  zValidator("json", z.object({ help: z.string().optional() })),
  zValidator("param", z.object({ notification_id: z.string().optional() })),
  async (c) => {
    if (c.req.valid("json").help) return c.text(help)

    const notificationId = c.req.valid("param").notification_id

    if (!notificationId) throw new UsageError("引数 <id> が必要です")

    const client = await createClient()

    const response = await client.system.notifications[":id"].$patch({
      param: { id: notificationId },
      json: { read: true },
    })
    if (response.status !== 200) throw new UsageError("通知の既読化に失敗しました")

    const data = await response.json()

    return c.json(data)
  },
)
