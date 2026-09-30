import { createClient } from "@/lib/api/hc-client"
import { toApiResponseError } from "@/lib/api/to-api-response-error"
import type { ApplicationWorkflow } from "@/lib/api/types/application-workflow-types"

export async function updateApplicationWorkflow(
  code: string,
  workflow: ApplicationWorkflow,
  expectedRevision: number,
) {
  const client = await createClient()
  const response = await client["company"]["application-templates"][":code"].workflow.$put({
    param: { code },
    json: { ...workflow, expected_revision: expectedRevision },
  })
  if (response.status >= 400) {
    return toApiResponseError(response, "承認フローの保存に失敗しました")
  }
  return response.json()
}
