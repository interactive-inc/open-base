import type { SystemRequestAudit } from "@system/configuration/system-context"
import {
  auditOutcomeSchema,
  createCompanyAuditRecord,
} from "@/contexts/company/domain/definitions/company-audit-record.definition"
import type {
  AuditJsonValue,
  AuditOutcome,
  CompanyAuditDetail,
  CompanyAuditRecord,
  CompanyAuditSummary,
} from "@/contexts/company/domain/definitions/company-audit-record.definition"
import { CompanyValidationError } from "@/contexts/company/domain/errors"
import { zAccountId, type AccountId } from "@system/domain/schemas/iam/account-id.schema"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import { z } from "zod"

export const auditActionSchema = z.enum([
  "auth.session.login_succeeded",
  "auth.session.login_denied",
  "auth.session.refreshed",
  "auth.session.logout",
  "auth.session.reuse_detected",
  "auth.bootstrap.completed",
  "iam.role.created",
  "iam.role.updated",
  "iam.role.deleted",
  "iam.account.role_granted",
  "iam.account.role_revoked",
  "iam.account.status_changed",
  "iam.account.password_reset",
  "iam.identity.provisioned",
  "iam.identity.provision_updated",
  "auth.session.identity_login_succeeded",
  "auth.session.identity_login_denied",
  "auth.session.cli_login_succeeded",
  "auth.session.cli_login_denied",
  "auth.session.browser_login_succeeded",
  "employee.account.registered",
  "employee.account.retired",
  "employee.account.deleted",
  "employee.lifecycle.applied",
  "employee.lifecycle.corrected",
  "employee.lifecycle.read",
  "employee.lifecycle.read_all",
  "employee.lifecycle.denied",
  "employee.lifecycle.requested",
  "employee.lifecycle.request_withdrawn",
  "employee.archived",
  "employee.lifecycle.projections_rebuilt",
  "application.workflow.updated",
  "application.workflow.repaired",
  "application.delegation.created",
  "application.delegation.cancelled",
  "application.decision.approved",
  "application.decision.rejected",
  "governance.document.synced",
  "governance.review.submitted",
  "governance.review.decided",
  "governance.document.published",
  "governance.document.acknowledged",
  "governance.org_role.assigned",
  "governance.org_role.revoked",
  "governance.org_role.migration_completed",
  "audit.event.searched",
  "audit.event.read",
  "audit.event.exported",
])

export const auditTargetTypeSchema = z.enum([
  "session",
  "role",
  "account",
  "identity",
  "employee",
  "application_workflow",
  "application",
  "approval_delegation",
  "governance_document",
  "governance_version",
  "governance_org_role",
  "audit_event",
  "audit_export",
])

export type AuditAction = z.infer<typeof auditActionSchema>
export type AuditTargetType = z.infer<typeof auditTargetTypeSchema>

export type AuditEventInput = Readonly<{
  actorAccountId: AccountId | null
  actorEmployeeId: EmployeeId | null
  action: AuditAction
  target: Readonly<{ type: AuditTargetType; id: string | null }>
  outcome: AuditOutcome
  reasonCode: string | null
  authorization?: AuditJsonValue
  before?: AuditJsonValue
  after?: AuditJsonValue
  metadata?: AuditJsonValue
  now: Date
}>

export type AuditEventRecord = CompanyAuditRecord & Readonly<{ actorEmployeeId: EmployeeId | null }>
export type AuditEventSummary = CompanyAuditSummary &
  Readonly<{ actorEmployeeId: EmployeeId | null }>
export type AuditEventDetail = CompanyAuditDetail & Readonly<{ actorEmployeeId: EmployeeId | null }>

const actorAccountIdSchema = zAccountId.nullable()
const actorEmployeeIdSchema = zEmployeeId.nullable()
const eventEnvelopeSchema = z.strictObject({
  actorAccountId: actorAccountIdSchema,
  actorEmployeeId: actorEmployeeIdSchema,
  action: z.unknown(),
  target: z.unknown(),
  outcome: z.unknown(),
  reasonCode: z.string().nullable(),
  authorization: z.unknown().optional(),
  before: z.unknown().optional(),
  after: z.unknown().optional(),
  metadata: z.unknown().optional(),
  now: z.unknown(),
})
const targetShapeSchema = z.strictObject({
  type: z.string().min(1),
  id: z.string().min(1).nullable(),
})

function parseManagedValue<Output>(
  schema: z.ZodType<Output>,
  value: unknown,
  message: string,
  code: string,
): Output {
  let parsed: ReturnType<typeof schema.safeParse>
  try {
    parsed = schema.safeParse(value)
  } catch (error) {
    throw new CompanyValidationError(message, code, { cause: error })
  }
  if (!parsed.success) {
    throw new CompanyValidationError(message, code, { cause: parsed.error })
  }
  return parsed.data
}

/** Company の閉じた語彙と Employee 文脈を System の汎用監査エンベロープへ合成する。 */
export function createAuditEvent(
  input: AuditEventInput,
  context: SystemRequestAudit,
): AuditEventRecord {
  const eventInput = parseManagedValue(
    eventEnvelopeSchema,
    input,
    "audit event input is invalid",
    "audit_invalid_event",
  )
  const action = parseManagedValue(
    auditActionSchema,
    eventInput.action,
    "audit event action is invalid",
    "audit_invalid_action",
  )
  const target = parseManagedValue(
    targetShapeSchema,
    eventInput.target,
    "audit event target is invalid",
    "audit_invalid_target",
  )
  const targetType = parseManagedValue(
    auditTargetTypeSchema,
    target.type,
    "audit event target type is invalid",
    "audit_invalid_target_type",
  )
  const outcome = parseManagedValue(
    auditOutcomeSchema,
    eventInput.outcome,
    "audit event outcome is invalid",
    "audit_invalid_outcome",
  )

  const record = createCompanyAuditRecord(
    {
      actorAccountId: eventInput.actorAccountId,
      action,
      target: { type: targetType, id: target.id },
      outcome,
      reasonCode: eventInput.reasonCode,
      authorization: input.authorization,
      before: input.before,
      after: input.after,
      metadata: input.metadata,
      now: input.now,
    },
    context,
  )

  return { ...record, actorEmployeeId: eventInput.actorEmployeeId }
}
