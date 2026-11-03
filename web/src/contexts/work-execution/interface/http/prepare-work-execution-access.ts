import type { Context } from "hono"
import type { HonoEnv } from "@/bindings"
import { HTTPException } from "hono/http-exception"
import { prepareSystemReadAuthorization } from "@system/interface/operations/prepare-system-read-authorization"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { prepareSystemAuditEventAppend } from "@system/interface/operations/prepare-system-audit-event-append"

export async function prepareWorkExecutionAccess(c: Context<HonoEnv>, permission: string) {
  c.header("Cache-Control", "no-store")
  const authentication = c.var.bearerReadAuthentication
  if (!authentication) throw new HTTPException(401)
  const machine = authentication.machineCredentialId !== null
  if (permission === "work_execution:manage" && machine) throw new HTTPException(403)
  const database = c.env.DB
  const now = c.var.now()
  const proof = await prepareSystemReadAuthorization({ database, authentication, at: now })
  if (proof instanceof Error) throw new HTTPException(503)
  if (!proof?.permissionKeys.has(permission)) throw new HTTPException(403)
  const guards = proof.assertions(now)
  if (guards instanceof Error) throw new HTTPException(403)
  return {
    database,
    now,
    accountId: authentication.accountId,
    machine,
    guards,
    audit(targetType: string, targetId: string, revision: number) {
      const event = SystemAuditEventEntity.create({
        actorAccountId: authentication.accountId,
        action: "work_execution.recorded",
        targetType,
        targetId,
        outcome: "succeeded",
        reasonCode: null,
        authorizationJson: JSON.stringify({ permission }),
        beforeJson: null,
        afterJson: null,
        metadataJson: JSON.stringify({ revision, request_id: c.var.auditContext.requestId }),
        occurredAt: now,
      })
      if (event instanceof Error) throw new HTTPException(503)
      return prepareSystemAuditEventAppend({ database, event })
    },
  }
}
