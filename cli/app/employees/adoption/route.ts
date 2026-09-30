import { factory } from "@/factory"
import { UsageError, InputError } from "@/lib/errors"
import { createClient } from "@/lib/http/hc-client"
import { readJsonObjectFile } from "@/lib/input/read-json-file"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { companyOrganizationId } from "@/lib/company/company-organization-id"

export const help = `base employees adoption --employee-id <id>
base employees adoption --data <confirmed-history.json> --idempotency-key <uuid>

employee-idで既存の全雇用・在籍履歴とsnapshotDigest・expectedRevision・observedOnを確認します。
dataにはemployeeIdとこの参照、reason、確認済みのPerson・Employee・全Employmentのresourcesを指定します。
既存の公開履歴を接続する場合はreuseExistingHistory: trueを指定し、全revisionと現在の公開版を照合します。
現在の氏名を過去へ推測して補わず、原資料で確認した有効期間だけを送ってください。
再送は同じJSONとキーを使い、競合時は台帳を確認し直してください。`

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
      const response = await client.company["employee-resource-adoptions"].$get({
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
        reason: z.string().trim().min(1).max(1500),
        reuseExistingHistory: z.literal(true).optional(),
        resources: z
          .array(
            z
              .object({
                organizationId: z.literal(companyOrganizationId),
                type: z.enum(["person", "employee", "employment"]),
                id: z.string(),
                revision: z.number().int().min(1).max(100),
                state: z.enum(["active", "void"]),
                effectiveFrom: z.string().date(),
                effectiveTo: z.string().date().nullable(),
                attributes: z.record(z.string(), z.string().nullable()),
              })
              .strict(),
          )
          .min(2)
          .max(100),
      })
      .strict()
      .safeParse(await readJsonObjectFile(input.data))
    if (!body.success) throw new InputError("確認済み履歴JSONの形式が不正です")
    const client = await createClient()
    const response = await client.company["employee-resource-adoptions"].$post({
      header: { "idempotency-key": input["idempotency-key"] },
      json: body.data,
    })
    return c.json(await response.json())
  },
)
