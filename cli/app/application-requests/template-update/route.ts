import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `base application-requests template-update --code <c> --name <n> --category <cat> [--description <d>] [--schema <json>] [--approvers <r,r>]`

function parseApprovers(value: string | undefined): string[] {
  if (value === undefined) return []

  return value
    .split(",")
    .map((role) => role.trim())
    .filter((role) => role !== "")
}

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      code: z.string().optional(),
      name: z.string().optional(),
      category: z.string().optional(),
      description: z.string().optional(),
      schema: z.string().optional(),
      approvers: z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    if (!query.code || !query.name || !query.category) {
      throw new UsageError("--code と --name と --category が必要です")
    }

    const client = await createClient()

    const response = await client["company"]["application-templates"][":code"].$put({
      param: { code: query.code },
      json: {
        name: query.name,
        category: query.category,
        description: query.description ?? null,
        schema_json: query.schema !== undefined ? JSON.parse(query.schema) : {},
        approver_roles: parseApprovers(query.approvers),
      },
    })

    const template = await response.json()

    return c.json(template)
  },
)
