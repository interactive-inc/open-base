import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { UsageError } from "@/lib/errors"
import { factory } from "@/factory"

export const help = `base notifications read-all — 全件既読`

export default factory.createHandlers(
  zValidator("json", z.object({ help: z.string().optional() })),
  async (c) => {
    if (c.req.valid("json").help) return c.text(help)

    const client = await createClient()

    const response = await client.system.notifications.$patch({ json: { read: true } })
    if (response.status !== 200) throw new UsageError("通知の一括既読化に失敗しました")

    const data = await response.json()

    return c.text(`read-all updated=${data.marked_count}`)
  },
)
