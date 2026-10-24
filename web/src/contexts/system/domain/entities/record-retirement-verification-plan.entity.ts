import { SYSTEM_AUDIT_ACTIONS } from "@system/domain/catalogs/audit/system-audit-action.catalog"
import { z } from "zod"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { CanonicalSystemJsonValue } from "@system/domain/values/audit/canonical-system-json.value"
import { ProposalDigestValue } from "@system/domain/values/workflow/proposal-digest.value"

const recordKindSchema = z.string().regex(/^[a-z][a-z0-9_.:-]{0,199}$/)
const planSchema = z
  .strictObject({
    id: z.uuid(),
    freezeId: z.uuid(),
    sourceNamespace: z.string().regex(/^\S{1,255}$/),
    ownerContext: z.string().regex(/^[a-z][a-z0-9-]{0,99}$/),
    purpose: z.string().trim().min(1).max(255),
    capability: z
      .strictObject({
        revision: z.number().int().positive().safe(),
        recordKinds: z.array(recordKindSchema).min(1).max(256).readonly(),
      })
      .readonly(),
    coverage: z
      .array(
        z
          .strictObject({
            recordKind: recordKindSchema,
            terminalPageId: z.uuid(),
            terminalDigest: z.string().regex(/^[0-9a-f]{64}$/),
            pageCount: z.number().int().positive().safe(),
            recordCount: z.number().int().nonnegative().safe(),
          })
          .readonly(),
      )
      .min(1)
      .max(256)
      .readonly(),
    actorAccountId: z.string().trim().min(1).max(255),
    createdAt: z.iso.datetime(),
    auditEventId: z.uuid(),
  })
  .readonly()
type Snapshot = z.output<typeof planSchema>

/** 全種別の照合終端と再検査順序を固定する。検査完了や撤去の実行許可は表さない。 */
export class RecordRetirementVerificationPlanEntity {
  private constructor(
    readonly snapshot: Snapshot,
    readonly digest: string,
    readonly totalPages: number,
  ) {
    Object.freeze(this)
  }

  static async create(input: unknown): Promise<RecordRetirementVerificationPlanEntity | Error> {
    const parsed = planSchema.safeParse(input)
    if (!parsed.success) return parsed.error
    const snapshot = parsed.data
    const kinds = snapshot.capability.recordKinds
    if (new Set(kinds).size !== kinds.length || snapshot.coverage.length !== kinds.length)
      return new Error("retirement plan kind coverage differs")
    if (snapshot.coverage.some((coverage, index) => coverage.recordKind !== kinds[index]))
      return new Error("retirement plan kind order differs")
    if (new Set(snapshot.coverage.map((coverage) => coverage.terminalPageId)).size !== kinds.length)
      return new Error("retirement plan terminal page duplicated")
    const totalPages = snapshot.coverage.reduce((total, coverage) => total + coverage.pageCount, 0)
    const totalRecords = snapshot.coverage.reduce(
      (total, coverage) => total + coverage.recordCount,
      0,
    )
    if (!Number.isSafeInteger(totalPages) || !Number.isSafeInteger(totalRecords))
      return new Error("retirement plan count overflow")
    const canonical = CanonicalSystemJsonValue.create(snapshot)
    if (canonical instanceof Error) return canonical
    const digest = await ProposalDigestValue.create(canonical)
    if (digest instanceof Error) return digest
    return new RecordRetirementVerificationPlanEntity(snapshot, digest.toString(), totalPages)
  }

  static async restore(input: unknown, expectedDigest: string) {
    const plan = await this.create(input)
    if (plan instanceof Error) return plan
    return plan.digest === expectedDigest ? plan : new Error("retirement plan digest differs")
  }

  audit(): SystemAuditEventEntity | Error {
    return SystemAuditEventEntity.restore({
      eventId: this.snapshot.auditEventId,
      actorAccountId: this.snapshot.actorAccountId,
      action: SYSTEM_AUDIT_ACTIONS.systemRecordRetirementPlanCreated,
      targetType: "system:record-retirement-plan",
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
      occurredAtEpochMilliseconds: Date.parse(this.snapshot.createdAt),
    })
  }

  target(ordinal: number) {
    if (!Number.isSafeInteger(ordinal) || ordinal < 1 || ordinal > this.totalPages)
      return new Error("retirement verification position is outside the plan")
    let precedingPages = 0
    for (const coverage of this.snapshot.coverage) {
      if (ordinal <= precedingPages + coverage.pageCount)
        return Object.freeze({
          planId: this.snapshot.id,
          planDigest: this.digest,
          ordinal,
          freezeId: this.snapshot.freezeId,
          sourceNamespace: this.snapshot.sourceNamespace,
          ownerContext: this.snapshot.ownerContext,
          purpose: this.snapshot.purpose,
          recordKind: coverage.recordKind,
          sequence: ordinal - precedingPages,
          terminalDigest: coverage.terminalDigest,
        })
      precedingPages += coverage.pageCount
    }
    return new Error("retirement verification position is missing")
  }
}
