import { createClient } from "@/lib/api/hc-client"
import { companyOrganizationId } from "@/lib/api/company-organization-id"
import { toResponseError } from "@/lib/api/to-response-error"
import type { GradeDefinitionCommand } from "@/lib/api/types/grade-types"

/** 確認した会社版と再送キーを変更せず、等級の改訂または取消を保存する。 */
export async function saveGradeDefinition(command: GradeDefinitionCommand) {
  const client = await createClient()
  const response = await client.company.definitions.$post({
    header: {
      "x-company-organization-id": companyOrganizationId,
      "idempotency-key": command.commandId,
      "if-match": String(command.expectedRevision),
    },
    json: { reason: command.reason, resources: [command.resource] },
  })
  if (response.status >= 400)
    return toResponseError(response, {
      fallback:
        "等級の改訂を保存できませんでした。確認した情報が変更されている場合は再読込してください",
    })
  return response.json()
}
