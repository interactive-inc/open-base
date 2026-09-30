import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { ApiError, UsageError } from "@/lib/errors"

export const help = `base employee-events list (--employee-code <code> | --employee-id <id>) [--kind <k>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      "employee-code": z.string().optional(),
      "employee-id": z.string().optional(),
      kind: z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)
    if ((query["employee-code"] === undefined) === (query["employee-id"] === undefined))
      throw new UsageError("--employee-code または --employee-id の一方が必要です")

    const client = await createClient()

    const response = await client.company["personnel-annotations"].$get({
      query: {
        employee_code: query["employee-code"],
        employee_id: query["employee-id"],
        kind: query.kind,
      },
    })

    if (!response.ok) throw new ApiError(response.status, "人事注記を参照できません")
    const rows = await response.json()

    return c.json(rows)
  },
)
