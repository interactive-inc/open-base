import { z } from "zod"
import { RecordRetirementVerificationPlanEntity } from "@system/domain/entities/record-retirement-verification-plan.entity"
import { RecordRetirementVerificationReceiptEntity } from "@system/domain/entities/record-retirement-verification-receipt.entity"
import { CanonicalSystemJsonValue } from "@system/domain/values/audit/canonical-system-json.value"
import { ProposalDigestValue } from "@system/domain/values/workflow/proposal-digest.value"

const intentSchema = z.strictObject({
  version: z.literal(1),
  operation: z.literal("system.record.retire"),
  actorAccountId: z.string().trim().min(1).max(255),
  reason: z.string().trim().min(1).max(3000),
  plan: z.unknown(),
  planDigest: z.string().regex(/^[0-9a-f]{64}$/),
  terminalReceipt: z.unknown(),
  terminalReceiptDigest: z.string().regex(/^[0-9a-f]{64}$/),
})
type Props = Readonly<{
  canonical: CanonicalSystemJsonValue
  digest: ProposalDigestValue
  plan: RecordRetirementVerificationPlanEntity
  terminalReceipt: RecordRetirementVerificationReceiptEntity
  actorAccountId: string
  reason: string
}>

/** 撤去対象と検査終端を人の判断対象に固定する。承認、現在の保全条件、撤去実行は別途検査する。 */
export class RecordRetirementProposalValue {
  private constructor(readonly props: Props) {
    Object.freeze(this)
  }

  static async create(
    input: Readonly<{
      plan: RecordRetirementVerificationPlanEntity
      terminalReceipt: RecordRetirementVerificationReceiptEntity
      actorAccountId: string
      reason: string
    }>,
  ): Promise<RecordRetirementProposalValue | Error> {
    const plan = input.plan
    const receipt = input.terminalReceipt
    const target = plan.target(plan.totalPages)
    if (target instanceof Error) return target
    const terminal = plan.snapshot.coverage.at(-1)
    if (
      terminal === undefined ||
      receipt.snapshot.planId !== plan.snapshot.id ||
      receipt.snapshot.planDigest !== plan.digest ||
      receipt.snapshot.ordinal !== plan.totalPages ||
      receipt.snapshot.coveragePageId !== terminal.terminalPageId ||
      receipt.snapshot.coveragePageDigest !== terminal.terminalDigest ||
      Date.parse(receipt.snapshot.checkedAt) < Date.parse(plan.snapshot.createdAt)
    )
      return new Error("retirement proposal does not reference the plan terminal receipt")
    const parsed = intentSchema.safeParse({
      version: 1,
      operation: "system.record.retire",
      actorAccountId: input.actorAccountId,
      reason: input.reason,
      plan: plan.snapshot,
      planDigest: plan.digest,
      terminalReceipt: receipt.snapshot,
      terminalReceiptDigest: receipt.digest,
    })
    if (!parsed.success) return parsed.error
    const canonical = CanonicalSystemJsonValue.create(parsed.data)
    if (canonical instanceof Error) return canonical
    const digest = await ProposalDigestValue.create(canonical)
    if (digest instanceof Error) return digest
    return new RecordRetirementProposalValue(
      Object.freeze({
        canonical,
        digest,
        plan,
        terminalReceipt: receipt,
        actorAccountId: parsed.data.actorAccountId,
        reason: parsed.data.reason,
      }),
    )
  }

  /** 判断者へ提示する内容を、digestへ固定した全項目から構成する。 */
  toReview() {
    return Object.freeze({
      version: 1,
      operation: "system.record.retire",
      actorAccountId: this.props.actorAccountId,
      reason: this.props.reason,
      plan: this.props.plan.snapshot,
      planDigest: this.props.plan.digest,
      terminalReceipt: this.props.terminalReceipt.snapshot,
      terminalReceiptDigest: this.props.terminalReceipt.digest,
    })
  }

  static async restore(input: unknown): Promise<RecordRetirementProposalValue | Error> {
    const parsed = intentSchema.safeParse(input)
    if (!parsed.success) return parsed.error
    const plan = await RecordRetirementVerificationPlanEntity.restore(
      parsed.data.plan,
      parsed.data.planDigest,
    )
    if (plan instanceof Error) return plan
    const receipt = await RecordRetirementVerificationReceiptEntity.restore(
      parsed.data.terminalReceipt,
      parsed.data.terminalReceiptDigest,
    )
    if (receipt instanceof Error) return receipt
    return this.create({
      plan,
      terminalReceipt: receipt,
      actorAccountId: parsed.data.actorAccountId,
      reason: parsed.data.reason,
    })
  }
}
