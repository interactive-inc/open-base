import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `base employees update <code> --name <n> --employee-id <id> --company-revision <n> --person-revision <n> --effective-on <YYYY-MM-DD> --idempotency-key <uuid> --reason <text>

employees show の profile に含まれる人物ID・会社版・人物版・営業日を指定してください。
同じ変更の再送では同じ冪等キーを使います。競合時は内容を確認し直してください。`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      name: z.string().optional(),
      "employee-id": z
        .string()
        .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/)
        .optional(),
      "company-revision": z.coerce.number().int().nonnegative().optional(),
      "person-revision": z.coerce.number().int().positive().optional(),
      "effective-on": z.string().date().optional(),
      "idempotency-key": z.string().uuid().optional(),
      reason: z.string().trim().min(1).max(1500).optional(),
    }),
  ),
  zValidator("param", z.object({ employee_code: z.string().optional() })),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    const employeeCode = c.req.valid("param").employee_code

    if (!employeeCode) throw new UsageError("引数 <code> が必要です")

    if (!query.name) throw new UsageError("--name が必要です")

    if (
      query["employee-id"] === undefined ||
      query["company-revision"] === undefined ||
      query["person-revision"] === undefined ||
      query["effective-on"] === undefined ||
      query["idempotency-key"] === undefined ||
      query.reason === undefined
    ) {
      throw new UsageError(
        "--employee-id, --company-revision, --person-revision, --effective-on, --idempotency-key, --reason が必要です",
      )
    }
    const client = await createClient()

    const response = await client.company["employee-directory"][":code"].$put({
      param: { code: employeeCode },
      header: { "idempotency-key": query["idempotency-key"] },
      json: {
        name: query.name,
        reason: query.reason,
        profile: {
          employeeId: query["employee-id"],
          organizationRevision: query["company-revision"],
          personRevision: query["person-revision"],
          effectiveOn: query["effective-on"],
        },
      },
    })

    return c.json(await response.json())
  },
)
