import { SYSTEM_AUDIT_ACTIONS } from "@system/domain/catalogs/audit/system-audit-action.catalog"
import { z } from "zod"
import type { RecordRetirementProposalValue } from "@system/domain/values/records/record-retirement-proposal.value"
import type { ExecutionAuthorizationEntity } from "@system/domain/entities/execution-authorization.entity"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"

const identifier = z.string().trim().min(1).max(255)
const digest = z.string().regex(/^[0-9a-f]{64}$/)
const snapshotSchema = z
  .strictObject({
    id: z.uuid(),
    freezeId: z.uuid(),
    planId: z.uuid(),
    planDigest: digest,
    terminalReceiptId: z.uuid(),
    terminalReceiptDigest: digest,
    proposalId: identifier,
    proposalVersion: z.number().int().positive().safe(),
    proposalDigest: digest,
    caseId: identifier,
    executionAuthorizationId: identifier,
    actorAccountId: identifier,
    finalizedAt: z.iso.datetime(),
    auditEventId: z.uuid(),
  })
  .readonly()
type Snapshot = z.output<typeof snapshotSchema>

/** 停止世代の撤去確定を承認版と検査終端へ固定する。原記録の削除は表さない。 */
export class RecordSourceRetirementEntity {
  private constructor(readonly snapshot: Snapshot) {
    Object.freeze(this)
  }

  static create(
    input: Readonly<{
      id: string
      proposal: RecordRetirementProposalValue
      proposalId: string
      proposalVersion: number
      authorization: ExecutionAuthorizationEntity
      at: Date
      auditEventId: string
    }>,
  ): RecordSourceRetirementEntity | Error {
    const proposal = input.proposal.props
    const authorization = input.authorization
    if (
      authorization.operationKey !== "system.record.retire" ||
      authorization.grantedToAccountId !== proposal.actorAccountId ||
      authorization.proposalDigest !== proposal.digest.toString() ||
      input.at.getTime() < Date.parse(proposal.terminalReceipt.snapshot.checkedAt)
    )
      return new Error("record retirement authorization differs")
    const used = authorization.use(proposal.digest.toString(), input.at)
    if (used instanceof Error) return used
    return this.restore({
      id: input.id,
      freezeId: proposal.plan.snapshot.freezeId,
      planId: proposal.plan.snapshot.id,
      planDigest: proposal.plan.digest,
      terminalReceiptId: proposal.terminalReceipt.snapshot.id,
      terminalReceiptDigest: proposal.terminalReceipt.digest,
      proposalId: input.proposalId,
      proposalVersion: input.proposalVersion,
      proposalDigest: proposal.digest.toString(),
      caseId: authorization.caseId,
      executionAuthorizationId: authorization.id,
      actorAccountId: authorization.grantedToAccountId,
      finalizedAt: input.at.toISOString(),
      auditEventId: input.auditEventId,
    })
  }

  static restore(input: unknown): RecordSourceRetirementEntity | Error {
    const parsed = snapshotSchema.safeParse(input)
    if (!parsed.success) return parsed.error
    if (Date.parse(parsed.data.finalizedAt) < 0)
      return new Error("record retirement time is invalid")
    return new RecordSourceRetirementEntity(parsed.data)
  }

  audit(): SystemAuditEventEntity | Error {
    return SystemAuditEventEntity.restore({
      eventId: this.snapshot.auditEventId,
      actorAccountId: this.snapshot.actorAccountId,
      action: SYSTEM_AUDIT_ACTIONS.systemRecordSourceRetired,
      targetType: "system:record-source-retirement",
      targetId: this.snapshot.id,
      outcome: "succeeded",
      reasonCode: null,
      authorizationJson: JSON.stringify({
        executionAuthorizationId: this.snapshot.executionAuthorizationId,
      }),
      beforeJson: null,
      afterJson: JSON.stringify(this.snapshot),
      metadataJson: null,
      occurredAtEpochMilliseconds: Date.parse(this.snapshot.finalizedAt),
    })
  }
}
