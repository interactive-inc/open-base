import { encodePathParams } from "@base/http/encode-path-params"
import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"
import { resolveNotificationId } from "@/app/notifications/lib/resolve-notification-id"

export const help = `base notifications show <notification-id>
base notifications show --id <notification-id>`

export default factory.createHandlers(
  zValidator("json", z.object({ help: z.string().optional(), id: z.string().optional() })),
  zValidator("param", z.object({ notification_id: z.string().optional() })),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    const id = resolveNotificationId(c.req.valid("param").notification_id, query.id)

    const client = await createClient()

    const response = await client.system.notifications[":id"].$get({
      param: encodePathParams({ id }),
    })
    if (response.status !== 200) throw new UsageError("通知の取得に失敗しました")

    const notification = await response.json()

    return c.json(notification)
  },
)
