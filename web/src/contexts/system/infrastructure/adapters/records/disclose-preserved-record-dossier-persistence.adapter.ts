import { PreparePreservedRecordExportPeriodGuardAdapter } from "@system/infrastructure/adapters/records/prepare-preserved-record-export-period-guard.adapter"
import type { SystemD1Context } from "@system/configuration/system-context"
import type { SystemReadAuthentication } from "@system/domain/definitions/system-read-authentication.definition"
import type { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import type { SystemAttachmentRow } from "@system/infrastructure/schema/system-attachment"
import { PreservedRecordDisclosureDeniedError } from "@system/domain/errors"
import { PreparePreservedRecordDossierAuthorizationAdapter } from "@system/infrastructure/adapters/records/prepare-preserved-record-dossier-authorization.adapter"
import { PreparePreservedRecordDossierAdapter } from "@system/infrastructure/adapters/records/prepare-preserved-record-dossier.adapter"
import { PreservedRecordRepository } from "@system/infrastructure/repositories/records/preserved-record.repository"
import { PreservedRecordDisclosurePolicyRepository } from "@system/infrastructure/repositories/records/preserved-record-disclosure-policy.repository"
import { SystemAuditEventRepository } from "@system/infrastructure/repositories/audit/system-audit-event.repository"
import { PrepareAttachmentContentReadGuardAdapter } from "@system/infrastructure/adapters/attachments/prepare-attachment-content-read-guard.adapter"

type Context = SystemD1Context &
  Readonly<{
    authentication: SystemReadAuthentication
    purpose: string
  }>
type Prepared = Exclude<
  Awaited<ReturnType<DisclosePreservedRecordDossierPersistenceAdapter["prepare"]>>,
  Error
>

/** 一括出力の資格と履歴を読み、最終再検査・原文固定・開示監査を同じtransactionで確定する。 */
export class DisclosePreservedRecordDossierPersistenceAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(recordId: string, at: Date) {
    const authorization = await new PreparePreservedRecordDossierAuthorizationAdapter(
      this.c,
    ).prepare(at)
    if (authorization instanceof Error) return authorization
    const assertions = authorization.assertions(at)
    if (assertions instanceof Error) return assertions
    const context = { env: this.c.env, assertions }
    const record = await new PreservedRecordRepository(context).find(recordId)
    if (record instanceof Error) return record
    if (record === null) return new PreservedRecordDisclosureDeniedError()
    const policy = await new PreservedRecordDisclosurePolicyRepository(context).findCurrent(
      record.snapshot.disclosurePolicyId,
    )
    if (policy instanceof Error) return policy
    const request = {
      recordId,
      accountId: this.c.authentication.accountId,
      action: "export",
      purpose: this.c.purpose,
      at,
    }
    if (policy === null || !policy.permits(request))
      return new PreservedRecordDisclosureDeniedError()
    const dossier = await new PreparePreservedRecordDossierAdapter(context).prepare({
      record,
      accountId: this.c.authentication.accountId,
      permissionKeys: authorization.permissionKeys,
      at,
      auditDisclosure: authorization.auditDisclosure,
    })
    if (dossier instanceof Error) return dossier
    return { record, policy, request, dossier, authorization }
  }

  async write(
    input: Readonly<{
      prepared: Prepared
      attachment: SystemAttachmentRow
      audit: SystemAuditEventEntity
      at: Date
    }>,
  ) {
    const authorization = await new PreparePreservedRecordDossierAuthorizationAdapter(
      this.c,
    ).prepare(input.at)
    if (authorization instanceof Error) return authorization
    const current = authorization.assertions(input.at)
    const original = input.prepared.authorization.assertions(input.at)
    if (current instanceof Error || original instanceof Error)
      return new Error("record dossier authorization changed")
    const request = { ...input.prepared.request, at: input.at }
    if (!input.prepared.policy.permits(request)) return new PreservedRecordDisclosureDeniedError()
    const context = { env: this.c.env, assertions: [...original, ...current] }
    const policyGuards = new PreservedRecordDisclosurePolicyRepository(
      context,
    ).prepareDisclosureGuard(input.prepared.policy, request)
    if (policyGuards instanceof Error) return policyGuards
    const periodGuard = new PreparePreservedRecordExportPeriodGuardAdapter(this.c).prepare({
      policy: input.prepared.policy,
      accountId: request.accountId,
      purpose: request.purpose,
      at: input.at,
    })
    const guards = [
      ...policyGuards,
      periodGuard,
      ...input.prepared.dossier.guards(input.at),
      new PrepareAttachmentContentReadGuardAdapter(this.c).prepare(input.attachment, input.at),
    ]
    return new SystemAuditEventRepository(context).append(input.audit, guards, guards)
  }
}
