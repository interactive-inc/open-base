import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"

export const help = `base personnel-actions list [--employee-id <id>] [--id <action-id>] [--from <date>] [--to <date>] [--limit <1-100>] [--cursor <cursor>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      "employee-id": z.string().optional(),
      id: z.string().optional(),
      from: z.string().date().optional(),
      to: z.string().date().optional(),
      limit: z.coerce.number().int().min(1).max(100).optional(),
      cursor: z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")
    if (query.help) return c.text(help)
    const client = await createClient()
    const response = await client.company["personnel-actions"].$get({
      query: {
        employee_id: query["employee-id"],
        id: query.id,
        from: query.from,
        to: query.to,
        limit: query.limit === undefined ? undefined : String(query.limit),
        cursor: query.cursor,
      },
    })
    return c.json(await response.json())
  },
)
