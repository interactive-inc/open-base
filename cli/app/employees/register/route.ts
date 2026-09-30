import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"
import { readSecretStdin } from "@/lib/input/read-secret-stdin"

export const help = `base employees register --company-revision <n> --code <c> --name <n> --hire-on <YYYY-MM-DD> --employment-type <FULL_TIME|PART_TIME> --email <e> --role <r> --password-stdin [--idempotency-key <uuid>] [--department-code <c>] [--position-code <c>] [--manager-employee-code <c>]

役職は確認した会社版と入社日に有効な公開定義の code を指定してください（自由入力ではありません）。
初期パスワードはコマンド引数に含めず、標準入力から渡してください。`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      "company-revision": z.coerce.number().int().nonnegative().optional(),
      code: z.string().optional(),
      name: z.string().optional(),
      email: z.string().optional(),
      "password-stdin": z.string().optional(),
      "idempotency-key": z.string().uuid().optional(),
      "employment-type": z.enum(["FULL_TIME", "PART_TIME"]).optional(),
      role: z.enum(["member", "manager", "hr", "root"]).optional(),
      "hire-on": z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional(),
      "department-code": z.string().optional(),
      "position-code": z.string().optional(),
      "manager-employee-code": z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    if (
      query["company-revision"] === undefined ||
      !query.code ||
      !query.name ||
      !query.email ||
      !query.role ||
      !query["hire-on"] ||
      !query["employment-type"] ||
      !query["password-stdin"]
    )
      throw new UsageError(
        "--company-revision, --code, --name, --hire-on, --employment-type, --email, --role, --password-stdin が必要です",
      )

    const password = await readSecretStdin()

    const payload = {
      expected_company_revision: query["company-revision"],
      code: query.code,
      name: query.name,
      email: query.email,
      password,
      role: query.role,
      hire_on: query["hire-on"],
      employment_type: query["employment-type"],
      department_code: query["department-code"] ?? null,
      position_code: query["position-code"] ?? null,
      manager_employee_code: query["manager-employee-code"] ?? null,
    }

    const client = await createClient()

    const response = await client.company["employee-registrations"].$post(
      { json: payload },
      { headers: { "Idempotency-Key": query["idempotency-key"] ?? crypto.randomUUID() } },
    )

    return c.json(await response.json())
  },
)
