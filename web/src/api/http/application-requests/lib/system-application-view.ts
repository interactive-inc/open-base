import { parseJsonValue } from "@/api/http/application-requests/lib/parse-json-value"
import type {
  SystemProposalStatus,
  SystemProposalView,
} from "@system/domain/definitions/workflow/system-proposal-view.definition"

export function toApplicationStatus(
  status: SystemProposalStatus,
): "pending" | "approved" | "rejected" {
  if (status === "approved" || status === "executed") return "approved"
  if (status === "rejected") return "rejected"
  return "pending"
}

export function toApplicationCurrentStep(proposal: SystemProposalView): string | null {
  if (proposal.status === "returned") return `returned:${proposal.lastTaskKey}`
  return proposal.status === "pending" ? proposal.currentTaskKey : null
}

export function parseSystemApplicationBody(
  proposal: SystemProposalView,
): Readonly<{ value: unknown }> | Error {
  const parsed = parseJsonValue(proposal.bodyJson)
  if (parsed instanceof Error) {
    return new Error("invalid System proposal body", { cause: parsed })
  }

  return parsed
}

export function toSystemStatuses(
  status: "pending" | "approved" | "rejected" | undefined,
): ReadonlyArray<SystemProposalStatus> | null {
  if (status === "pending") return ["pending", "returned"]
  if (status === "approved") return ["approved", "executed"]
  if (status === "rejected") return ["rejected"]
  return null
}
