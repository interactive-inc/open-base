import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"
import { createClient } from "@/lib/http/hc-client"
import { readJsonObjectFile } from "@/lib/input/read-json-file"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

export const help = `base personnel-actions correct --action-id <id> --payload <json-file> --reason <text> --company-revision <n> --employee-revision <n> --idempotency-key <key> [--organization-revision <n>]

入社・再入社のpayloadには employmentType（FULL_TIME または PART_TIME）が必要です。訂正でも replacementAction に指定してください。`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      "action-id": z.string().uuid().optional(),
      payload: z.string().optional(),
      reason: z.string().min(1).max(2000).optional(),
      "company-revision": z.coerce.number().int().nonnegative().optional(),
      "employee-revision": z.coerce.number().int().nonnegative().optional(),
      "organization-revision": z.coerce.number().int().nonnegative().optional(),
      "idempotency-key": z.string().min(1).max(200).optional(),
    }),
  ),
  async (c) => {
    const input = c.req.valid("json")
    if (input.help) return c.text(help)
    if (
      !input["action-id"] ||
      !input.payload ||
      !input.reason ||
      input["company-revision"] === undefined ||
      input["employee-revision"] === undefined ||
      !input["idempotency-key"]
    ) {
      throw new UsageError(
        "--action-id, --payload, --reason, --company-revision, --employee-revision, --idempotency-key が必要です",
      )
    }
    const file = await readJsonObjectFile(input.payload)
    const client = await createClient()
    const endpoint = client.company["personnel-action-executions"].$post
    type RequestJson = Parameters<typeof endpoint>[0]["json"]
    const response = await endpoint(
      {
        json: {
          action: {
            ...file,
            kind: "corrected",
            correctsActionId: input["action-id"],
            reason: input.reason,
          },
          expected_company_revision: input["company-revision"],
          expected_employee_revision: input["employee-revision"],
          expected_organization_revision: input["organization-revision"] ?? null,
        } as RequestJson,
      },
      { headers: { "Idempotency-Key": input["idempotency-key"] } },
    )
    return c.json(await response.json())
  },
)
