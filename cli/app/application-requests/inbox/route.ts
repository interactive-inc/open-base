import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"

export const help = `base application-requests inbox — 承認待ち一覧`

const json = () => zValidator("json", z.object({ help: z.string().optional() }).passthrough())

export default factory.createHandlers(json(), async (c) => {
  if (c.req.valid("json").help) return c.text(help)

  const client = await createClient()

  const response = await client["company"]["application-requests"].inbox.$get()

  const rows = await response.json()

  return c.json(rows)
})
