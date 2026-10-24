import { SYSTEM_AUDIT_ACTIONS } from "@system/domain/catalogs/audit/system-audit-action.catalog"
import type { DisclosePreservedRecordPersistenceAdapter } from "@system/infrastructure/adapters/records/disclose-preserved-record-persistence.adapter"
import { PreservedRecordDisclosureDeniedError } from "@system/domain/errors"
import type {
  SystemDatabaseContext,
  SystemAttachmentStorageContext,
} from "@system/configuration/system-context"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { VerifyPreservedRecordContentAdapter } from "@system/infrastructure/adapters/records/verify-preserved-record-content.adapter"
import { preservedRecordDisclosureCommandSchema } from "@system/domain/schemas/records/preserved-record-disclosure-command.schema"

type Context = SystemDatabaseContext &
  SystemAttachmentStorageContext &
  Readonly<{
    accountId: string
    now: () => Date
    persistence: DisclosePreservedRecordPersistenceAdapter
  }>

/** 最新の開示設定を検査し、監査保存後に保全された原文を返す。 */
export class DisclosePreservedRecordContent {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(input: unknown) {
    const command = preservedRecordDisclosureCommandSchema.safeParse(input)
    if (!command.success) return new Error("invalid record disclosure request")
    const record = await this.c.persistence.findRecord(command.data.recordId)
    if (record instanceof Error) return record
    if (record === null) return new PreservedRecordDisclosureDeniedError()
    const policy = await this.c.persistence.findPolicy(record.snapshot.disclosurePolicyId)
    if (policy instanceof Error) return policy
    if (policy === null) return new PreservedRecordDisclosureDeniedError()
    const request = { ...command.data, accountId: this.c.accountId, at: this.c.now() }
    if (!policy.permits(request)) return new PreservedRecordDisclosureDeniedError()
    const verified = await new VerifyPreservedRecordContentAdapter(this.c).execute(record, "linked")
    if (verified instanceof Error) return verified
    const at = this.c.now()
    if (!policy.permits({ ...request, at })) return new PreservedRecordDisclosureDeniedError()
    const audit = SystemAuditEventEntity.create({
      actorAccountId: this.c.accountId,
      action: SYSTEM_AUDIT_ACTIONS.systemRecordDisclosed,
      targetType: "system:preserved-record",
      targetId: record.snapshot.id,
      outcome: "succeeded",
      reasonCode: null,
      authorizationJson: JSON.stringify({
        policyId: policy.snapshot.id,
        revision: policy.snapshot.revision,
        action: command.data.action,
        purpose: command.data.purpose,
      }),
      beforeJson: null,
      afterJson: null,
      metadataJson: JSON.stringify({ contentDigest: record.source.props.contentDigest }),
      occurredAt: at,
    })
    if (audit instanceof Error) return audit
    const guards = this.c.persistence.prepareGuards({
      policy,
      request: { ...request, at },
      attachment: verified.attachment,
      at,
    })
    if (guards instanceof Error) return guards
    const written = await this.c.persistence.write({
      policy,
      request: { ...request, at },
      attachment: verified.attachment,
      audit,
      at,
    })
    if (written instanceof Error) return written
    return Object.freeze({
      assertions: guards,
      recordId: record.snapshot.id,
      source: record.source.props,
      content: verified.payload.content.toBytes(),
    })
  }
}
