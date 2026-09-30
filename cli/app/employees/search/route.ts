import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"

export const help = `base employees search — 社員検索

usage:
  base employees search [--q <キーワード>] [--dept <部署名>] [--status active|leave|retired]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      q: z.string().optional(),
      dept: z.string().optional(),
      status: z.enum(["active", "leave", "retired"]).optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    const client = await createClient()

    const response = await client.company["employee-directory"].$get({
      query: { q: query.q, organization_unit: query.dept, status: query.status },
    })

    const rows = await response.json()

    return c.json(rows)
  },
)
