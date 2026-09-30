import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { renderOrgTree } from "@/app/departments/tree/_modules/render-org-tree"

export const help = `base departments tree — 部署ツリー`

export default factory.createHandlers(
  zValidator("json", z.object({ help: z.string().optional() })),
  async (c) => {
    if (c.req.valid("json").help) return c.text(help)

    const client = await createClient()

    const response = await client.company["organization-tree"].$get()

    const nodes = await response.json()

    return c.text(renderOrgTree(nodes))
  },
)
