import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"

export const help = `base whoami — 自分の情報を表示`

export default factory.createHandlers(
  zValidator("json", z.object({ help: z.string().optional() })),
  async (c) => {
    if (c.req.valid("json").help) return c.text(help)

    const client = await createClient()

    const response = await client.company["current-profile"].$get()

    const me = await response.json()

    return c.json(me)
  },
)
