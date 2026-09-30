import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `base departments delete --code <department-code> --organization-revision <n> --as-of <YYYY-MM-DD> --idempotency-key <uuid>`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      code: z.string().optional(),
      "organization-revision": z
        .string()
        .regex(/^\d+$/)
        .transform(Number)
        .pipe(z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER))
        .optional(),
      "as-of": z.string().date().optional(),
      "idempotency-key": z.string().uuid().optional(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("json")

    if (query.help) return c.text(help)

    if (!query.code) throw new UsageError("--code が必要です")

    if (
      query["organization-revision"] === undefined ||
      query["as-of"] === undefined ||
      query["idempotency-key"] === undefined
    ) {
      throw new UsageError(
        "departments show で確認した --organization-revision, --as-of と --idempotency-key が必要です",
      )
    }

    const client = await createClient()

    const response = await client.company["organization-units"][":code"].$delete(
      {
        param: { code: query.code },
        json: {
          expected_organization_revision: query["organization-revision"],
          expected_as_of: query["as-of"],
        },
      },
      { headers: { "Idempotency-Key": query["idempotency-key"] } },
    )

    if (response.status !== 204) {
      throw new UsageError("部署ノードの削除に失敗しました")
    }

    return c.json({ code: query.code, status: "deleted" })
  },
)
