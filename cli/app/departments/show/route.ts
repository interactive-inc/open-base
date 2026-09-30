import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `base departments show --code <department-code>`

export default factory.createHandlers(
  zValidator("json", z.object({ help: z.string().optional(), code: z.string().optional() })),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    if (!query.code) throw new UsageError("--code が必要です")

    const client = await createClient()

    const response = await client.company["organization-units"][":code"].$get({
      param: { code: query.code },
    })

    const department = await response.json()

    return c.json(department)
  },
)
