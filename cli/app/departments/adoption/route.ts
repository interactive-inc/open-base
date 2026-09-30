import { factory } from "@/factory"
import { UsageError, InputError } from "@/lib/errors"
import { createClient } from "@/lib/http/hc-client"
import { readJsonObjectFile } from "@/lib/input/read-json-file"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

export const help = `base departments adoption --organization-unit-id <id>
base departments adoption --data <confirmed-history.json> --idempotency-key <uuid>

既存組織の全期間・訂正履歴とsnapshotDigest・expectedRevision・observedOnを確認します。
dataにはorganizationUnitIdとこの参照、reasonを指定します。親組織から順に接続してください。
仮の初期期間にはinitializationConfirmationで確認したstartsOnとevidenceReferencesを指定します。
履歴は台帳の値を保ったまま接続します。同じJSONとキーで再送し、競合時は確認し直してください。`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      "organization-unit-id": z.string().optional(),
      data: z.string().optional(),
      "idempotency-key": z.string().uuid().optional(),
    }),
  ),
  async (c) => {
    const input = c.req.valid("json")
    if (input.help) return c.text(help)
    if (input.data === undefined) {
      if (!input["organization-unit-id"] || input["idempotency-key"] !== undefined)
        throw new UsageError("参照は --organization-unit-id を指定してください")
      const client = await createClient()
      const response = await client.company["organization-resource-adoptions"].$get({
        query: { organization_unit_id: input["organization-unit-id"] },
      })
      return c.json(await response.json())
    }
    if (input["organization-unit-id"] !== undefined || input["idempotency-key"] === undefined)
      throw new UsageError("保存は --data と --idempotency-key を指定してください")
    const body = z
      .object({
        organizationUnitId: z.string(),
        expectedRevision: z.number().int().nonnegative(),
        snapshotDigest: z.string().regex(/^[a-f0-9]{64}$/),
        observedOn: z.string().date(),
        reason: z.string().trim().min(1).max(1000),
        initializationConfirmation: z
          .object({
            startsOn: z.string().date(),
            evidenceReferences: z
              .array(
                z
                  .object({
                    context: z.string().trim().min(1).max(100),
                    kind: z.string().trim().min(1).max(100),
                    id: z.string().trim().min(1).max(512),
                    version: z.string().trim().min(1).max(255),
                  })
                  .strict(),
              )
              .min(1)
              .max(20),
          })
          .strict()
          .optional(),
      })
      .strict()
      .safeParse(await readJsonObjectFile(input.data))
    if (!body.success) throw new InputError("確認済み組織JSONの形式が不正です")
    const client = await createClient()
    const response = await client.company["organization-resource-adoptions"].$post({
      header: { "idempotency-key": input["idempotency-key"] },
      json: body.data,
    })
    return c.json(await response.json())
  },
)
