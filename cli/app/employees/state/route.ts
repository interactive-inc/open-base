import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"
import { createClient } from "@/lib/http/hc-client"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

export const help = `base employees state --code <code> [--as-of <YYYY-MM-DD>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      code: z.string().optional(),
      "as-of": z.string().optional(),
    }),
  ),
  async (c) => {
    const input = c.req.valid("json")
    if (input.help) return c.text(help)
    if (!input.code) throw new UsageError("--code が必要です")
    const client = await createClient()
    const response = await client.company["employee-lifecycle"][":code"].state.$get({
      param: { code: input.code },
      query: { as_of: input["as-of"] },
    })
    return c.json(await response.json())
  },
)
