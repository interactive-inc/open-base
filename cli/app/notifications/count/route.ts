import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { UsageError } from "@/lib/errors"
import { factory } from "@/factory"

export const help = `base notifications count — 未読件数`

export default factory.createHandlers(
  zValidator("json", z.object({ help: z.string().optional() })),
  async (c) => {
    if (c.req.valid("json").help) return c.text(help)

    const client = await createClient()

    const response = await client.system.notifications["unread-count"].$get()
    if (response.status !== 200) throw new UsageError("未読件数の取得に失敗しました")

    const data = await response.json()

    return c.text(`未読: ${data.unread_count}件`)
  },
)
