import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `base departments members <dept_code> — 部署メンバー`

export default factory.createHandlers(
  zValidator("json", z.object({ help: z.string().optional() })),
  zValidator("param", z.object({ dept_code: z.string().optional() })),
  async (c) => {
    if (c.req.valid("json").help) return c.text(help)

    const deptCode = c.req.valid("param").dept_code

    if (!deptCode) throw new UsageError("引数 <dept_code> が必要です")

    const client = await createClient()

    const response = await client.company["organization-units"][":code"].members.$get({
      param: { code: deptCode },
    })

    const rows = await response.json()

    return c.json(rows)
  },
)
