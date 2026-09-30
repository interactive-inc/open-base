import { factory } from "@/factory"
import { UsageError, InputError } from "@/lib/errors"
import { createClient } from "@/lib/http/hc-client"
import { readJsonObjectFile } from "@/lib/input/read-json-file"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

export const help = `base employees assignment-adoption --employee-id <id>
base employees assignment-adoption --data <confirmed-history.json> --idempotency-key <uuid>

employee-idで既存の全所属・上長履歴とsnapshotDigest・expectedRevision・observedOnを確認します。
dataにはemployeeId、snapshotDigest、expectedRevision、observedOn、reasonを指定します。
既存の公開所属IDへ接続する期間はmappingsにperiodIdとexistingResourceIdを明示します。
先に従業員・雇用と組織の履歴を公開APIへ接続してください。
全改訂を保全し、訂正後の期間を公開AssignmentとReportingRelationへ接続します。
再送は同じJSONとキーを使い、競合時は履歴を確認し直してください。`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      "employee-id": z.string().optional(),
      data: z.string().optional(),
      "idempotency-key": z.string().uuid().optional(),
    }),
  ),
  async (c) => {
    const input = c.req.valid("json")
    if (input.help) return c.text(help)
    if (input.data === undefined) {
      if (!input["employee-id"] || input["idempotency-key"] !== undefined)
        throw new UsageError("参照は --employee-id を指定してください")
      const client = await createClient()
      const response = await client.company["assignment-resource-adoptions"].$get({
        query: { employee_id: input["employee-id"] },
      })
      return c.json(await response.json())
    }
    if (input["employee-id"] !== undefined || input["idempotency-key"] === undefined)
      throw new UsageError("保存は --data と --idempotency-key を指定してください")
    const body = z
      .object({
        employeeId: z.string(),
        expectedRevision: z.number().int().nonnegative(),
        snapshotDigest: z.string().regex(/^[a-f0-9]{64}$/),
        observedOn: z.string().date(),
        reason: z.string().trim().min(1).max(1000),
        mappings: z
          .array(
            z
              .object({
                periodId: z.string().regex(/^\S{1,255}$/),
                existingResourceId: z.string().regex(/^\S{1,255}$/),
              })
              .strict()
              .readonly(),
          )
          .min(1)
          .max(1000)
          .readonly()
          .optional(),
      })
      .strict()
      .safeParse(await readJsonObjectFile(input.data))
    if (!body.success) throw new InputError("確認済み履歴JSONの形式が不正です")
    const client = await createClient()
    const response = await client.company["assignment-resource-adoptions"].$post({
      header: { "idempotency-key": input["idempotency-key"] },
      json: body.data,
    })
    return c.json(await response.json())
  },
)
