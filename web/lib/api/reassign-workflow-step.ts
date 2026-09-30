import type { EntityId } from "@/lib/api/types/entity-id"
import { createClient } from "@/lib/api/hc-client"
import { toApiResponseError } from "@/lib/api/to-api-response-error"

export type ReassignWorkflowStepRequest = {
  candidate_employee_ids: ReadonlyArray<string>
  required_approvals?: number
  reason: string
}

/** POST /application-requests/:id/reassign-workflow-step。API の監査・競合・再検証をそのまま利用する。 */
export async function reassignWorkflowStep(
  applicationId: EntityId,
  request: ReassignWorkflowStepRequest,
) {
  const client = await createClient()
  const response = await client["company"]["application-requests"][":id"][
    "reassign-workflow-step"
  ].$post({
    param: { id: String(applicationId) },
    json: {
      candidate_employee_ids: [...request.candidate_employee_ids],
      required_approvals: request.required_approvals,
      reason: request.reason,
    },
  })

  if (response.status >= 400) {
    return toApiResponseError(response, "承認候補者を再割当できませんでした")
  }

  return response.json()
}
