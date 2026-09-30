import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"
import { ensureOk } from "@/lib/http/ensure-ok"

export const help = `base application-requests workflow <template_code> [--definition '<json>' --expected-revision <n>]`

type WorkflowEndpoint = {
  $get(input: { param: { code: string } }): Promise<Response>
  $put(input: { param: { code: string }; json: unknown }): Promise<Response>
}

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      code: z.string().optional(),
      definition: z.string().optional(),
      "expected-revision": z.string().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")
    if (query.help) return c.text(help)
    const code = c.req.param("code") ?? query.code
    if (!code) throw new UsageError("template_code が必要です")
    const client = (await createClient()) as unknown as {
      company: { "application-templates": { ":code": { workflow: WorkflowEndpoint } } }
    }
    const endpoint = client.company["application-templates"][":code"].workflow
    if (query.definition === undefined) {
      const response = await endpoint.$get({ param: { code } })
      await ensureOk(response)
      return c.json(await response.json())
    }
    const expectedRevisionInput = query["expected-revision"]
    if (expectedRevisionInput === undefined) {
      throw new UsageError("--expected-revision が必要です")
    }
    if (/^(0|[1-9]\d*)$/.test(expectedRevisionInput) === false) {
      throw new UsageError("--expected-revision は0以上の整数で指定してください")
    }
    const expectedRevision = Number(expectedRevisionInput)
    if (Number.isSafeInteger(expectedRevision) === false) {
      throw new UsageError("--expected-revision は0以上の整数で指定してください")
    }
    let definition: unknown
    try {
      definition = JSON.parse(query.definition)
    } catch {
      throw new UsageError("--definition は正しい JSON が必要です")
    }
    if (typeof definition !== "object" || definition === null || Array.isArray(definition)) {
      throw new UsageError("--definition はJSONオブジェクトで指定してください")
    }
    const response = await endpoint.$put({
      param: { code },
      json: { ...definition, expected_revision: expectedRevision },
    })
    await ensureOk(response)
    return c.json(await response.json())
  },
)
