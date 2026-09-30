import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `base notifications send --to <employee_code> --title <t> [--body <b>] [--kind task|approval_request|approval_result|reminder|announcement]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      to: z.string().optional(),
      title: z.string().optional(),
      body: z.string().optional(),
      kind: z
        .enum(["task", "approval_request", "approval_result", "reminder", "announcement"])
        .optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    if (!query.to || !query.title) throw new UsageError("--to と --title が必要です")

    const client = await createClient()

    const response = await client["company"]["notifications"].$post({
      json: {
        recipient_employee_code: query.to,
        title: query.title,
        body: query.body,
        kind: query.kind,
      },
    })

    const data = await response.json()

    return c.json(data)
  },
)
