import type { Context } from "hono"
import type { HonoEnv } from "@/bindings"
import { HTTPException } from "hono/http-exception"
import { prepareSystemReadAuthorization } from "@system/interface/operations/prepare-system-read-authorization"
import { prepareCompanyAuthoritySnapshotGuard } from "@/contexts/company/interface/operations/prepare-company-authority-snapshot-guard"
import { openCompanyEmployeeDirectory } from "@/contexts/company/interface/operations/open-company-employee-directory"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { prepareSystemAuditEventAppend } from "@system/interface/operations/prepare-system-audit-event-append"

export async function prepareEmployedActor(c: Context<HonoEnv>, permission: string) {
  c.header("Cache-Control", "no-store")
  const actor = c.var.session
  const authentication = c.var.bearerReadAuthentication
  const now = c.var.now()
  const database = c.env.DB
  if (
    !actor ||
    !authentication ||
    authentication.machineCredentialId !== null ||
    authentication.accountId !== actor.accountId
  )
    throw new HTTPException(403, { message: "human_session_required" })
  const proof = await prepareSystemReadAuthorization({ database, authentication, at: now })
  if (proof instanceof Error) throw new HTTPException(503, { message: "authorization_unavailable" })
  if (proof === null || !proof.permissionKeys.has(permission))
    throw new HTTPException(403, { message: "permission_required" })
  const companyGuard = await prepareCompanyAuthoritySnapshotGuard(
    { database },
    {
      accountIds: [actor.accountId],
      employeeCodes: [],
    },
  )
  const people = await openCompanyEmployeeDirectory(c).findForAccountIds([actor.accountId])
  if (companyGuard instanceof Error || people instanceof Error)
    throw new HTTPException(503, { message: "employment_unavailable" })
  const employee = people.find((person) => person.accountId === actor.accountId)?.employee
  if (employee?.id !== actor.employeeId || employee.employment?.status !== "ACTIVE")
    throw new HTTPException(403, { message: "active_employment_required" })
  const assertions = proof.assertions(now)
  if (assertions instanceof Error)
    throw new HTTPException(403, { message: "authorization_changed" })
  const requestId = c.var.auditContext.requestId
  return {
    db: database,
    guards: [...assertions, companyGuard],
    accountId: actor.accountId,
    employeeId: actor.employeeId,
    requestId,
    audit: (target: string, id: string, revision: number) => {
      const event = SystemAuditEventEntity.create({
        actorAccountId: actor.accountId,
        action: `${target}.record.saved`,
        targetType: target,
        targetId: id,
        outcome: "succeeded",
        reasonCode: null,
        authorizationJson: JSON.stringify({ permission }),
        beforeJson: null,
        afterJson: null,
        metadataJson: JSON.stringify({ revision, request_id: requestId }),
        occurredAt: now,
      })
      if (event instanceof Error) throw new HTTPException(503, { message: "audit_unavailable" })
      return prepareSystemAuditEventAppend({ database, event })
    },
    now,
  }
}
