import { resolveCompanyAccountParticipants } from "@/api/http/accounts/resolve-company-account-participants"
import type { CompanyAccountParticipant } from "@/api/http/accounts/resolve-company-account-participants"
import type { Context } from "@/env"
import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"

export async function resolveActiveCompanyAccountParticipant(
  c: Context,
  accountId: AccountId,
): Promise<CompanyAccountParticipant | null | Error> {
  const participants = await resolveCompanyAccountParticipants(c, [accountId])
  if (participants instanceof Error) return participants
  const participant = participants.at(0) ?? null
  return participant !== null &&
    (participant.status === "ACTIVE" || participant.status === "ON_LEAVE")
    ? participant
    : null
}
