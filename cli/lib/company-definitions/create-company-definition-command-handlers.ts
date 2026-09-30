import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { factory } from "@/factory"
import { InputError, UsageError } from "@/lib/errors"
import { createClient } from "@/lib/http/hc-client"
import { readJsonObjectFile } from "@/lib/input/read-json-file"

/** 確認済みの会社版と資源版をそのまま送信し、定義を公開履歴だけへ保存する。 */
export function createCompanyDefinitionCommandHandlers(props: {
  type: "grade" | "position"
  action: "create" | "update" | "delete"
  help: string
}) {
  return factory.createHandlers(
    zValidator(
      "json",
      z
        .object({
          help: z.string().optional(),
          data: z.string().optional(),
          "idempotency-key": z
            .string()
            .regex(/^\S{1,255}$/)
            .optional(),
        })
        .strict(),
    ),
    async (context) => {
      const input = context.req.valid("json")
      if (input.help) return context.text(props.help)
      if (input.data === undefined || input["idempotency-key"] === undefined)
        throw new UsageError("確認済みの --data と --idempotency-key が必要です")
      const identity = z.string().regex(/^\S{1,255}$/)
      const resource = {
        organizationId: identity,
        id: identity,
        revision: z.number().int().positive(),
        state: z.enum(["active", "void"]),
        effectiveFrom: z.string().date(),
        effectiveTo: z.string().date().nullable(),
      }
      const attributes = {
        code: z.string().trim().min(1).max(255),
        officialName: z.string().trim().min(1).max(2_000),
        rank: z.number().int().nullable().optional(),
        description: z.string().trim().min(1).max(2_000).nullable().optional(),
      }
      const parsed = z
        .object({
          organizationId: identity,
          expectedRevision: z
            .number()
            .int()
            .nonnegative()
            .max(Number.MAX_SAFE_INTEGER - 1),
          reason: z.string().trim().min(1).max(2_000),
          resources: z
            .array(
              z.discriminatedUnion("type", [
                z
                  .object({
                    ...resource,
                    type: z.literal("grade"),
                    attributes: z.object(attributes).strict(),
                  })
                  .strict(),
                z
                  .object({
                    ...resource,
                    type: z.literal("position"),
                    attributes: z.object({ ...attributes, jobId: identity.nullable() }).strict(),
                  })
                  .strict(),
              ]),
            )
            .min(1)
            .max(100),
        })
        .strict()
        .safeParse(await readJsonObjectFile(input.data))
      if (!parsed.success) throw new InputError("公開定義JSONの形式が不正です")
      const command = parsed.data
      if (
        command.resources.some(
          (entry) =>
            entry.type !== props.type ||
            entry.organizationId !== command.organizationId ||
            entry.state !== (props.action === "delete" ? "void" : "active") ||
            (props.action === "create" ? entry.revision !== 1 : entry.revision < 2),
        )
      )
        throw new InputError("資源の種類・会社・版・取消状態がコマンドと一致しません")
      const client = await createClient()
      const request = {
        header: {
          "x-company-organization-id": command.organizationId,
          "if-match": String(command.expectedRevision),
          "idempotency-key": input["idempotency-key"],
        },
        json: { reason: command.reason, resources: command.resources },
      }
      return context.json(await (await client.company.definitions.$post(request)).json())
    },
  )
}
