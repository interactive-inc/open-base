import { SYSTEM_AUDIT_ACTIONS } from "@system/domain/catalogs/audit/system-audit-action.catalog"
import type {
  SystemDatabaseContext,
  SystemAttachmentStorageContext,
} from "@system/configuration/system-context"
import type { DisclosePreservedRecordDossierPersistenceAdapter } from "@system/infrastructure/adapters/records/disclose-preserved-record-dossier-persistence.adapter"
import { VerifyPreservedRecordContentAdapter } from "@system/infrastructure/adapters/records/verify-preserved-record-content.adapter"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { toBase64 } from "@system/application/attachments/lib/to-base64"
import { z } from "zod"

type Context = SystemDatabaseContext &
  SystemAttachmentStorageContext &
  Readonly<{
    accountId: string
    purpose: string
    now: () => Date
    persistence: DisclosePreservedRecordDossierPersistenceAdapter
  }>

/** 原文と確定根拠を揃え、最終認可と開示監査の成功後に一括出力する。 */
export class DisclosePreservedRecordDossier {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(recordId: string) {
    if (!z.uuid().safeParse(recordId).success) return new Error("invalid record identifier")
    const prepared = await this.c.persistence.prepare(recordId, this.c.now())
    if (prepared instanceof Error) return prepared
    const verified = await new VerifyPreservedRecordContentAdapter(this.c).execute(
      prepared.record,
      "linked",
    )
    if (verified instanceof Error) return verified
    const at = this.c.now()
    const audit = SystemAuditEventEntity.create({
      actorAccountId: this.c.accountId,
      action: SYSTEM_AUDIT_ACTIONS.systemRecordDossierExported,
      targetType: "system:preserved-record",
      targetId: recordId,
      outcome: "succeeded",
      reasonCode: null,
      authorizationJson: JSON.stringify({
        action: "export",
        purpose: this.c.purpose,
        disclosurePolicyId: prepared.policy.snapshot.id,
        disclosurePolicyRevision: prepared.policy.snapshot.revision,
      }),
      beforeJson: null,
      afterJson: null,
      metadataJson: JSON.stringify({
        contentDigest: prepared.record.source.props.contentDigest,
        caseId: prepared.dossier.history.execution.caseId,
        auditReceiptCount: prepared.dossier.history.auditReceipts.length,
      }),
      occurredAt: at,
    })
    if (audit instanceof Error) return audit
    const written = await this.c.persistence.write({
      prepared,
      attachment: verified.attachment,
      audit,
      at,
    })
    if (written instanceof Error) return written
    return Object.freeze({
      version: 1,
      exportedAt: at.toISOString(),
      exportAuditEventId: audit.eventId,
      source: prepared.record.source.props,
      contentBase64: toBase64(new Uint8Array(verified.payload.content.toBytes())),
      ...prepared.dossier.history,
    })
  }
}
