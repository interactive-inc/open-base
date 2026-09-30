import { parseDecisionTarget } from "@/lib/application-requests/parse-decision-target"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { ensureOk } from "@/lib/http/ensure-ok"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `base application-requests reject <id> --decision-target <json> --comment <c>`

const json = () => zValidator("json", z.object({ help: z.string().optional() }).passthrough())

export default factory.createHandlers(
  json(),
  zValidator("param", z.object({ app_id: z.string().optional() })),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    const appId = c.req.valid("param").app_id

    if (!appId) throw new UsageError("引数 <id> が必要です")

    const target = parseDecisionTarget(query["decision-target"])
    if (target instanceof Error) throw new UsageError(target.message)
    const comment = z
      .string()
      .max(3_000)
      .nullable()
      .safeParse(query.comment ?? null)
    if (!comment.success || comment.data === null || comment.data.length === 0)
      throw new UsageError("--comment が必要です")

    const client = await createClient()

    const response = await client["company"]["application-requests"][":id"].reject.$post({
      param: { id: appId },
      json: { comment: comment.data, decision_target: target },
    })

    await ensureOk(response)

    const result = await response.json()

    return c.text(`rejected id=${appId} status=${result.status}`)
  },
)
