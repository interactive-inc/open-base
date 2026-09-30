import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { factory } from "@/factory"
import { createClient } from "@/lib/http/hc-client"
import { ensureOk } from "@/lib/http/ensure-ok"

export const help = `base application-requests workflow-repair list [--limit <n>] [--offset <n>] — 修復が必要な承認フロー一覧`

export default factory.createHandlers(
  zValidator(
    "json",
    z
      .object({
        help: z.string().optional(),
        limit: z.string().regex(/^\d+$/).optional(),
        offset: z.string().regex(/^\d+$/).optional(),
      })
      .passthrough(),
  ),
  async (c) => {
    if (c.req.valid("json").help) {
      return c.text(help)
    }

    const query = c.req.valid("json")
    const client = await createClient()
    const response = await client["company"]["application-requests"]["workflow-repairs"].$get({
      query: { limit: query.limit, offset: query.offset },
    })
    await ensureOk(response)

    return c.json(await response.json())
  },
)
