import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"
import { createClient } from "@/lib/http/hc-client"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

export const help = `base employees timeline --code <code> [--from <date>] [--to <date>] [--cursor <cursor>] [--limit <n>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      code: z.string().optional(),
      from: z.string().optional(),
      to: z.string().optional(),
      cursor: z.string().max(256).optional(),
      limit: z.coerce.number().int().min(1).max(100).optional(),
    }),
  ),
  async (c) => {
    const input = c.req.valid("json")
    if (input.help) return c.text(help)
    if (!input.code) throw new UsageError("--code が必要です")
    const client = await createClient()
    const response = await client.company["employee-lifecycle"][":code"].events.$get({
      param: { code: input.code },
      query: {
        from: input.from,
        to: input.to,
        cursor: input.cursor,
        limit: input.limit === undefined ? undefined : String(input.limit),
      },
    })
    return c.json(await response.json())
  },
)
