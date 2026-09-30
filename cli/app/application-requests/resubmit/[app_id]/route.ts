import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `base application-requests resubmit <app_id> --payload '<json>'`
export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      app_id: z.string().optional(),
      payload: z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")
    if (query.help) return c.text(help)
    const id = c.req.param("app_id") ?? query.app_id
    if (!id || !query.payload) throw new UsageError("app_id と --payload が必要です")
    let payload: unknown
    try {
      payload = JSON.parse(query.payload)
    } catch {
      throw new UsageError("--payload は正しい JSON が必要です")
    }
    const response = await (
      await createClient()
    ).company["application-requests"][":id"].resubmit.$post({ param: { id }, json: { payload } })
    return c.json(await response.json())
  },
)
