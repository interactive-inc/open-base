import { SYSTEM_AUDIT_ACTIONS } from "@system/domain/catalogs/audit/system-audit-action.catalog"
import { recordStorageKeyFingerprintsSchema } from "@system/domain/schemas/records/record-storage-key-fingerprint.schema"
import { z } from "zod"
import { CanonicalSystemJsonValue } from "@system/domain/values/audit/canonical-system-json.value"
import { ProposalDigestValue } from "@system/domain/values/workflow/proposal-digest.value"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import type { RecordRetirementVerificationPlanEntity } from "@system/domain/entities/record-retirement-verification-plan.entity"
import type { RecordCoveragePageEntity } from "@system/domain/entities/record-coverage-page.entity"

const digestSchema = z.string().regex(/^[0-9a-f]{64}$/)
const receiptSchema = z
  .strictObject({
    id: z.uuid(),
    planId: z.uuid(),
    planDigest: digestSchema,
    ordinal: z.number().int().positive().safe(),
    coveragePageId: z.uuid(),
    coveragePageDigest: digestSchema,
    previousReceiptDigest: digestSchema.nullable(),
    storageKeys: recordStorageKeyFingerprintsSchema,
    actorAccountId: z.string().trim().min(1).max(255),
    checkedAt: z.iso.datetime(),
    auditEventId: z.uuid(),
  })
  .readonly()
type Snapshot = z.output<typeof receiptSchema>
type VerifiedPosition = Readonly<{
  plan: RecordRetirementVerificationPlanEntity
  page: RecordCoveragePageEntity
  previous: RecordRetirementVerificationReceiptEntity | null
}>

/** 固定した計画の一ページを検査した時点と順序を残す。現在の撤去許可は表さない。 */
export class RecordRetirementVerificationReceiptEntity {
  private constructor(
    readonly snapshot: Snapshot,
    readonly digest: string,
  ) {
    Object.freeze(this)
  }

  static async create(input: unknown, position: VerifiedPosition) {
    const receipt = await this.parse(input)
    if (receipt instanceof Error) return receipt
    const value = receipt.snapshot
    const target = position.plan.target(value.ordinal)
    if (target instanceof Error) return target
    const page = position.page.snapshot
    if (
      value.planId !== target.planId ||
      value.planDigest !== target.planDigest ||
      value.coveragePageId !== page.id ||
      value.coveragePageDigest !== position.page.digest ||
      target.freezeId !== page.freezeId ||
      target.sourceNamespace !== page.sourceNamespace ||
      target.ownerContext !== page.ownerContext ||
      target.purpose !== page.purpose ||
      target.recordKind !== page.recordKind ||
      target.sequence !== page.sequence ||
      Date.parse(value.checkedAt) < Date.parse(position.plan.snapshot.createdAt) ||
      Date.parse(value.checkedAt) < Date.parse(page.checkedAt)
    )
      return new Error("retirement verification differs from plan position")
    const previous = position.previous
    if (previous === null) {
      if (value.ordinal !== 1 || value.previousReceiptDigest !== null)
        return new Error("retirement verification must start at first position")
    } else if (
      value.id === previous.snapshot.id ||
      value.planId !== previous.snapshot.planId ||
      value.planDigest !== previous.snapshot.planDigest ||
      value.ordinal !== previous.snapshot.ordinal + 1 ||
      value.previousReceiptDigest !== previous.digest ||
      Date.parse(value.checkedAt) < Date.parse(previous.snapshot.checkedAt)
    )
      return new Error("retirement verification does not continue previous receipt")
    return receipt
  }

  static async restore(input: unknown, expectedDigest: string) {
    const receipt = await this.parse(input)
    if (receipt instanceof Error) return receipt
    return receipt.digest === expectedDigest
      ? receipt
      : new Error("retirement receipt digest differs")
  }

  audit() {
    return SystemAuditEventEntity.restore({
      eventId: this.snapshot.auditEventId,
      actorAccountId: this.snapshot.actorAccountId,
      action: SYSTEM_AUDIT_ACTIONS.systemRecordRetirementPageVerified,
      targetType: "system:record-retirement-receipt",
      targetId: this.snapshot.id,
      outcome: "succeeded",
      reasonCode: null,
      authorizationJson: JSON.stringify({
        required_permission_keys: ["system:admin"],
        principal_kind: "human",
        step_up: true,
      }),
      beforeJson: null,
      afterJson: JSON.stringify(this.snapshot),
      metadataJson: null,
      occurredAtEpochMilliseconds: Date.parse(this.snapshot.checkedAt),
    })
  }

  private static async parse(
    input: unknown,
  ): Promise<RecordRetirementVerificationReceiptEntity | Error> {
    const parsed = receiptSchema.safeParse(input)
    if (!parsed.success) return parsed.error
    const value = parsed.data
    if ((value.ordinal === 1) !== (value.previousReceiptDigest === null))
      return new Error("retirement receipt predecessor invalid")
    const canonical = CanonicalSystemJsonValue.create(value)
    if (canonical instanceof Error) return canonical
    const digest = await ProposalDigestValue.create(canonical)
    if (digest instanceof Error) return digest
    return new RecordRetirementVerificationReceiptEntity(value, digest.toString())
  }
}
