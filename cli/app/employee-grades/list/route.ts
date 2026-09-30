import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `base employee-grades list --organization-id <id> --employee-id <id> [--as-of <YYYY-MM-DD>] [--organization-revision <revision>]

公開Companyの等級割当を、会社版・資源版・雇用ID・有効期間とともに返します。
as-ofを省略すると将来予約を含む資源版、指定するとその日に有効な割当を返します。
未確定の旧付与記録はgrade-award-archives APIで参照します。`

export default factory.createHandlers(
  zValidator(
    "json",
    z.strictObject({
      help: z.string().optional(),
      "organization-id": z
        .string()
        .regex(/^\S{1,255}$/)
        .optional(),
      "employee-id": z
        .string()
        .regex(/^\S{1,255}$/)
        .optional(),
      "as-of": z.string().date().optional(),
      "organization-revision": z
        .string()
        .regex(/^(0|[1-9]\d*)$/)
        .refine((value) => Number.isSafeInteger(Number(value)))
        .optional(),
    }),
  ),
  async (context) => {
    const input = context.req.valid("json")
    if (input.help) return context.text(help)
    if (input["organization-id"] === undefined || input["employee-id"] === undefined)
      throw new UsageError("--organization-id と --employee-id が必要です")
    const client = await createClient()
    const response = await client.company["organization-snapshots"].$get({
      header: { "x-company-organization-id": input["organization-id"] },
      query: {
        ...(input["as-of"] === undefined ? {} : { effective_on: input["as-of"] }),
        ...(input["organization-revision"] === undefined
          ? {}
          : { organization_revision: input["organization-revision"] }),
      },
    })
    const snapshot = await response.json()
    return context.json({
      ...snapshot,
      resources: snapshot.resources.filter(
        (resource) =>
          resource.type === "grade-assignment" &&
          resource.attributes.employeeId === input["employee-id"],
      ),
    })
  },
)
