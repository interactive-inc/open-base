import type { CompanyPersonnelSession } from "@/contexts/company/domain/definitions/company-personnel-session.definition"
import type { CompanyActorValue } from "@/contexts/company/domain/values/company-actor.value"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"

/** Company Actorを人事発令Applicationのsessionへ写像する。 */
export function toCompanyPersonnelSession(
  actor: CompanyActorValue,
): CompanyPersonnelSession | null {
  if (actor.employeeId === null) return null
  return {
    accountId: zAccountId.parse(actor.accountId),
    employeeId: actor.employeeId,
    hasPermission(permission) {
      return permission === "employee:lifecycle:apply" && actor.hasPermission("employee:write")
    },
  }
}
