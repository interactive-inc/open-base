import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"

export const help = `base application-requests templates — 申請テンプレート一覧

usage:
  base application-requests templates [--category <category>]

詳細は base application-requests template <code> で確認できます。`

const json = () => zValidator("json", z.object({ help: z.string().optional() }).passthrough())

export default factory.createHandlers(json(), async (c) => {
  const query = c.req.valid("json")

  if (query.help) return c.text(help)

  const client = await createClient()

  const response = await client["company"]["application-templates"].$get({
    query: { category: query.category as string | undefined },
  })

  const rows = await response.json()

  return c.json(rows)
})
