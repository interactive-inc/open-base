import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `base application-requests delegate --employee <code> --start <iso> --end <iso> [--template <code>]`
export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      employee: z.string().optional(),
      start: z.string().optional(),
      end: z.string().optional(),
      template: z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")
    if (query.help) return c.text(help)
    if (!query.employee || !query.start || !query.end)
      throw new UsageError("--employee --start --end が必要です")
    const response = await (
      await createClient()
    ).company["approval-delegations"].$post({
      json: {
        delegate_employee_code: query.employee,
        template_code: query.template ?? null,
        starts_at: query.start,
        ends_at: query.end,
      },
    })
    return c.json(await response.json())
  },
)
