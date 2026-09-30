import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `base departments create --code <c> --name <n> [--parent <c>]`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      code: z.string().optional(),
      name: z.string().optional(),
      parent: z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    if (!query.code || !query.name) throw new UsageError("--code, --name が必要です")

    const client = await createClient()

    const response = await client.company["organization-units"].$post({
      json: {
        code: query.code,
        name: query.name,
        parent_code: query.parent ?? null,
      },
    })

    const department = await response.json()

    return c.json(department)
  },
)
