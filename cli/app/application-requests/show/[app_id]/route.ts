import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `base application-requests show <id>`

const json = () => zValidator("json", z.object({ help: z.string().optional() }).passthrough())

export default factory.createHandlers(
  json(),
  zValidator("param", z.object({ app_id: z.string().optional() })),
  async (c) => {
    if (c.req.valid("json").help) return c.text(help)

    const appId = c.req.valid("param").app_id

    if (!appId) throw new UsageError("引数 <id> が必要です")

    const client = await createClient()

    const response = await client["company"]["application-requests"][":id"].$get({
      param: { id: appId },
    })

    return c.json(await response.json())
  },
)
