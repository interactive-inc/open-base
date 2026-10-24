import { SYSTEM_AUDIT_ACTIONS } from "@system/domain/catalogs/audit/system-audit-action.catalog"
import type { FinalizePreservedRecordPersistenceAdapter } from "@system/infrastructure/adapters/records/finalize-preserved-record-persistence.adapter"
import type {
  SystemDatabaseContext,
  SystemAttachmentStorageContext,
} from "@system/configuration/system-context"
import type { PreservedRecordEntity } from "@system/domain/entities/preserved-record.entity"
import type { PreservedRecordDisclosurePolicyEntity } from "@system/domain/entities/preserved-record-disclosure-policy.entity"
import type { AttachmentPreservationEntity } from "@system/domain/entities/attachment-preservation.entity"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { VerifyPreservedRecordContentAdapter } from "@system/infrastructure/adapters/records/verify-preserved-record-content.adapter"

type Context = SystemDatabaseContext &
  SystemAttachmentStorageContext &
  Readonly<{ persistence: FinalizePreservedRecordPersistenceAdapter }>
type Command = Readonly<{
  record: PreservedRecordEntity
  disclosure: PreservedRecordDisclosurePolicyEntity
  preservation: AttachmentPreservationEntity
}>

/** 原記録の本文を検証し、保全・開示設定・確定記録を監査とともに保存する。 */
export class FinalizePreservedRecord {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(command: Command): Promise<PreservedRecordEntity | Error> {
    const record = command.record.snapshot
    const policy = command.disclosure.snapshot
    if (
      !command.record.matchesPreservation(command.preservation) ||
      policy.id !== record.disclosurePolicyId ||
      policy.recordId !== record.id ||
      policy.revision !== record.disclosurePolicyRevision ||
      policy.status !== "active" ||
      policy.actorAccountId !== record.actorAccountId ||
      Date.parse(policy.publishedAt) > Date.parse(record.finalizedAt)
    )
      return new Error("record preservation or disclosure does not match finalization")
    const authorized = await this.c.persistence.authorize()
    if (authorized instanceof Error) return authorized
    const existing = await this.c.persistence.find(command)
    if (existing !== null) return existing
    const verified = await new VerifyPreservedRecordContentAdapter(this.c).execute(
      command.record,
      "pending",
    )
    if (verified instanceof Error) {
      const raced = await this.c.persistence.find(command)
      return raced ?? verified
    }
    const recordAudit = this.audit({
      snapshot: record,
      action: SYSTEM_AUDIT_ACTIONS.systemRecordPreserved,
      targetType: "system:preserved-record",
      at: record.finalizedAt,
    })
    if (recordAudit instanceof Error) return recordAudit
    const policyAudit = this.audit({
      snapshot: policy,
      action: SYSTEM_AUDIT_ACTIONS.systemRecordDisclosurePolicyPublished,
      targetType: "system:record-disclosure-policy",
      at: policy.publishedAt,
    })
    if (policyAudit instanceof Error) return policyAudit
    const holdAudit = command.preservation.audit(null)
    if (holdAudit instanceof Error) return holdAudit
    const written = await this.c.persistence.executeAuthorized({
      command,
      recordAudit,
      policyAudit,
      holdAudit,
      attachment: verified.attachment,
    })
    if (written instanceof Error) return (await this.c.persistence.find(command)) ?? written
    return command.record
  }

  private audit(
    input: Readonly<{
      snapshot: { id: string; actorAccountId: string; auditEventId: string }
      action: string
      targetType: string
      at: string
    }>,
  ): SystemAuditEventEntity | Error {
    return SystemAuditEventEntity.restore({
      eventId: input.snapshot.auditEventId,
      actorAccountId: input.snapshot.actorAccountId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.snapshot.id,
      outcome: "succeeded",
      reasonCode: null,
      authorizationJson: null,
      beforeJson: null,
      afterJson: JSON.stringify(input.snapshot),
      metadataJson: null,
      occurredAtEpochMilliseconds: Date.parse(input.at),
    })
  }
}
