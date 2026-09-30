import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `base employees show <code>`

export default factory.createHandlers(
  zValidator("json", z.object({ help: z.string().optional() })),
  zValidator("param", z.object({ employee_code: z.string().optional() })),
  async (c) => {
    if (c.req.valid("json").help) return c.text(help)

    const employeeCode = c.req.valid("param").employee_code

    if (!employeeCode) throw new UsageError("引数 <code> が必要です")

    const client = await createClient()

    const response = await client.company["employee-directory"][":code"].$get({
      param: { code: employeeCode },
    })

    return c.json(await response.json())
  },
)
