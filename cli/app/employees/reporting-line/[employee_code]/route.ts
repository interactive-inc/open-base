import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `base employees reporting-line <employee_code> — レポートライン（上位）`

export default factory.createHandlers(
  zValidator("json", z.object({ help: z.string().optional() })),
  zValidator("param", z.object({ employee_code: z.string().optional() })),
  async (c) => {
    if (c.req.valid("json").help) return c.text(help)

    const employeeCode = c.req.valid("param").employee_code

    if (!employeeCode) throw new UsageError("引数 <employee_code> が必要です")

    const client = await createClient()

    const response = await client.company["reporting-lines"][":employeeCode"].$get({
      param: { employeeCode },
    })

    const rows = await response.json()

    return c.json(rows)
  },
)
