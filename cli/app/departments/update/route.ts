import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"

export const help = `base departments update --code <c> --name <n> [--parent <c>] --organization-revision <n> --as-of <YYYY-MM-DD> --idempotency-key <uuid>`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      code: z.string().optional(),
      name: z.string().optional(),
      parent: z.string().optional(),
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

    if (!query.code || !query.name) throw new UsageError("--code, --name が必要です")

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

    const response = await client.company["organization-units"][":code"].$put(
      {
        param: { code: query.code },
        json: {
          expected_organization_revision: query["organization-revision"],
          expected_as_of: query["as-of"],
          name: query.name,
          parent_code: query.parent ?? null,
        },
      },
      { headers: { "Idempotency-Key": query["idempotency-key"] } },
    )

    const department = await response.json()

    return c.json(department)
  },
)
