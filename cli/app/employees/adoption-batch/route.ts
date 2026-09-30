import { factory } from "@/factory"
import { UsageError, InputError } from "@/lib/errors"
import { createClient } from "@/lib/http/hc-client"
import { readJsonObjectFile } from "@/lib/input/read-json-file"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { companyOrganizationId } from "@/lib/company/company-organization-id"

export const help = `base employees adoption-batch --data <confirmed-employees.json> --idempotency-key <uuid>

employees adoption --employee-id <id>で各従業員の公開履歴を確認してから一括接続します。
dataには共通のexpectedRevision・observedOn・reasonと、employeeId・snapshotDigestのemployees一覧を指定します。
必要な従業員には確認済みのcorrectionsを指定でき、元の版を残して訂正版を追記します。
全員の履歴を照合し、訂正・接続・監査を一度に保存します。氏名や過去の期間は自動補完しません。
再送は同じJSONとキーを使い、競合時は台帳を確認し直してください。`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      data: z.string().optional(),
      "idempotency-key": z.string().uuid().optional(),
    }),
  ),
  async (c) => {
    const input = c.req.valid("json")
    if (input.help) return c.text(help)
    if (input.data === undefined || input["idempotency-key"] === undefined)
      throw new UsageError("保存は --data と --idempotency-key を指定してください")
    const body = z
      .object({
        expectedRevision: z
          .number()
          .int()
          .nonnegative()
          .max(Number.MAX_SAFE_INTEGER - 100),
        observedOn: z.string().date(),
        reason: z.string().trim().min(1).max(1500),
        employees: z
          .array(
            z
              .object({
                employeeId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/),
                snapshotDigest: z.string().regex(/^[a-f0-9]{64}$/),
                terminationBoundaryCorrection: z
                  .object({
                    employmentId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/),
                    endsOn: z.string().date(),
                  })
                  .strict()
                  .optional(),
                corrections: z
                  .array(
                    z
                      .object({
                        organizationId: z.literal(companyOrganizationId),
                        type: z.enum(["person", "employee", "employment"]),
                        id: z.string().regex(/^\S{1,255}$/),
                        revision: z.number().int().positive().max(100),
                        state: z.enum(["active", "void"]),
                        effectiveFrom: z.string().date(),
                        effectiveTo: z.string().date().nullable(),
                        attributes: z.record(z.string(), z.string().nullable()),
                      })
                      .strict(),
                  )
                  .min(1)
                  .max(20)
                  .optional(),
              })
              .strict(),
          )
          .min(1)
          .max(250)
          .refine(
            (employees) =>
              new Set(employees.map((employee) => employee.employeeId)).size === employees.length,
          ),
      })
      .strict()
      .safeParse(await readJsonObjectFile(input.data))
    if (!body.success) throw new InputError("確認済み従業員一覧JSONの形式が不正です")
    const client = await createClient()
    const response = await client.company["employee-resource-adoption-batches"].$post({
      header: { "idempotency-key": input["idempotency-key"] },
      json: body.data,
    })
    return c.json(await response.json())
  },
)
