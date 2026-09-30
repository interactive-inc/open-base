import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createClient } from "@/lib/http/hc-client"
import { factory } from "@/factory"
import { InputError, UsageError } from "@/lib/errors"
import { readJsonObjectFile } from "@/lib/input/read-json-file"

export const help = `base employee-grades create --data <confirmed-grade-assignment.json> --idempotency-key <key>

JSONにはorganizationId、expectedRevision、reason、resourcesを指定します。
resourcesはtype: grade-assignment、revision: 1、state: activeと、確認したID・有効期間を持ちます。
attributesにはemployeeId、employmentId、gradeIdが必要です。過去の雇用や期間は推測しません。`

export default factory.createHandlers(
  zValidator(
    "json",
    z.strictObject({
      help: z.string().optional(),
      data: z.string().optional(),
      "idempotency-key": z
        .string()
        .regex(/^\S{1,255}$/)
        .optional(),
    }),
  ),
  async (context) => {
    const input = context.req.valid("json")
    if (input.help) return context.text(help)
    if (input.data === undefined || input["idempotency-key"] === undefined)
      throw new UsageError("確認済みの --data と --idempotency-key が必要です")
    const identity = z.string().regex(/^\S{1,255}$/)
    const parsed = z
      .strictObject({
        organizationId: identity,
        expectedRevision: z
          .number()
          .int()
          .nonnegative()
          .max(Number.MAX_SAFE_INTEGER - 1),
        reason: z.string().trim().min(1).max(2000),
        resources: z
          .array(
            z.strictObject({
              organizationId: identity,
              type: z.literal("grade-assignment"),
              id: identity,
              revision: z.literal(1),
              state: z.literal("active"),
              effectiveFrom: z.string().date(),
              effectiveTo: z.string().date().nullable(),
              attributes: z.strictObject({
                employeeId: identity,
                employmentId: identity,
                gradeId: identity,
              }),
            }),
          )
          .min(1)
          .max(100),
      })
      .safeParse(await readJsonObjectFile(input.data))
    if (!parsed.success) throw new InputError("確認済み等級割当JSONの形式が不正です")
    const command = parsed.data
    if (
      command.resources.some(
        (entry) =>
          entry.organizationId !== command.organizationId ||
          (entry.effectiveTo !== null && entry.effectiveTo <= entry.effectiveFrom),
      )
    )
      throw new InputError("会社または有効期間が不正です")
    const client = await createClient()
    const response = await client.company["organization-changes"].$post({
      header: {
        "x-company-organization-id": command.organizationId,
        "if-match": String(command.expectedRevision),
        "idempotency-key": input["idempotency-key"],
      },
      json: { reason: command.reason, resources: command.resources },
    })
    return context.json(await response.json())
  },
)
