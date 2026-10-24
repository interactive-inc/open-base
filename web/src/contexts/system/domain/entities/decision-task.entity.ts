import { zAccountId, type AccountId } from "@system/domain/schemas/iam/account-id.schema"
import type { HumanAttestationEntity } from "@system/domain/entities/human-attestation.entity"
import { InvalidSystemWorkflowError } from "@system/domain/errors"
import {
  proposalDigestSchema,
  type ProposalDigest,
} from "@system/domain/schemas/workflow/system-case-reference.schema"
import {
  systemCaseIdSchema,
  type SystemCaseId,
} from "@system/domain/schemas/workflow/system-case.schema"
import { z } from "zod"

const propsSchema = z
  .object({
    caseId: systemCaseIdSchema,
    key: z.string().min(1).max(100),
    round: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    candidateAccountIds: z.array(zAccountId).min(1).max(100),
    excludedAccountIds: z.array(zAccountId).max(100),
    requiredApprovals: z.number().int().positive().max(100),
    requiredParticipants: z.number().int().positive().max(100).default(1),
    negativeDecisionRule: z.enum(["any-reject", "approval-impossible"]).default("any-reject"),
    delegationPolicy: z.enum(["allowed", "forbidden"]).default("allowed"),
    returnPolicy: z.enum(["allowed", "forbidden"]).default("allowed"),
    proposalDigest: proposalDigestSchema,
    openedAt: z.date(),
    dueAt: z.date().nullable(),
  })
  .strict()

type ParsedProps = z.output<typeof propsSchema>

export type DecisionTaskOutcome = "pending" | "approved" | "rejected" | "returned"

/** 判断候補、除外主体、quorum、対象digestを開始時点で固定するSystem Task。 */
export class DecisionTaskEntity {
  readonly caseId: SystemCaseId
  readonly key: string
  readonly round: number
  readonly candidateAccountIds: ReadonlyArray<AccountId>
  readonly excludedAccountIds: ReadonlyArray<AccountId>
  readonly requiredApprovals: number
  readonly requiredParticipants: number
  readonly negativeDecisionRule: "any-reject" | "approval-impossible"
  readonly delegationPolicy: "allowed" | "forbidden"
  readonly returnPolicy: "allowed" | "forbidden"
  readonly proposalDigest: ProposalDigest
  readonly #openedAtEpochMilliseconds: number
  readonly #dueAtEpochMilliseconds: number | null

  private constructor(props: ParsedProps) {
    this.caseId = props.caseId
    this.key = props.key
    this.round = props.round
    this.candidateAccountIds = Object.freeze([...props.candidateAccountIds])
    this.excludedAccountIds = Object.freeze([...props.excludedAccountIds])
    this.requiredApprovals = props.requiredApprovals
    this.requiredParticipants = props.requiredParticipants
    this.negativeDecisionRule = props.negativeDecisionRule
    this.delegationPolicy = props.delegationPolicy
    this.returnPolicy = props.returnPolicy
    this.proposalDigest = props.proposalDigest
    this.#openedAtEpochMilliseconds = props.openedAt.getTime()
    this.#dueAtEpochMilliseconds = props.dueAt?.getTime() ?? null
    Object.freeze(this)
  }

  static create(input: unknown): DecisionTaskEntity | InvalidSystemWorkflowError {
    const parsed = propsSchema.safeParse(input)

    if (!parsed.success) return new InvalidSystemWorkflowError("invalid_shape", parsed.error)
    if (new Set(parsed.data.candidateAccountIds).size !== parsed.data.candidateAccountIds.length) {
      return new InvalidSystemWorkflowError("duplicate_candidate")
    }
    if (new Set(parsed.data.excludedAccountIds).size !== parsed.data.excludedAccountIds.length) {
      return new InvalidSystemWorkflowError("duplicate_candidate")
    }
    if (
      parsed.data.candidateAccountIds.some((candidateAccountId) =>
        parsed.data.excludedAccountIds.includes(candidateAccountId),
      )
    ) {
      return new InvalidSystemWorkflowError("candidate_excluded")
    }
    if (
      parsed.data.requiredApprovals > parsed.data.candidateAccountIds.length ||
      parsed.data.requiredParticipants > parsed.data.candidateAccountIds.length
    ) {
      return new InvalidSystemWorkflowError("invalid_shape")
    }
    if (
      parsed.data.dueAt !== null &&
      parsed.data.dueAt.getTime() < parsed.data.openedAt.getTime()
    ) {
      return new InvalidSystemWorkflowError("invalid_chronology")
    }

    return new DecisionTaskEntity(parsed.data)
  }

  get openedAt(): Date {
    return new Date(this.#openedAtEpochMilliseconds)
  }

  get dueAt(): Date | null {
    return this.#dueAtEpochMilliseconds === null ? null : new Date(this.#dueAtEpochMilliseconds)
  }

  evaluate(
    attestations: ReadonlyArray<HumanAttestationEntity>,
  ): DecisionTaskOutcome | InvalidSystemWorkflowError {
    const actorAccountIds = new Set<AccountId>()
    const representedAccountIds = new Set<AccountId>()

    for (const attestation of attestations) {
      if (
        (this.delegationPolicy === "forbidden" && attestation.delegationId !== null) ||
        (this.returnPolicy === "forbidden" && attestation.action === "return")
      ) {
        return new InvalidSystemWorkflowError("attestation_mismatch")
      }
      if (
        attestation.caseId !== this.caseId ||
        attestation.taskKey !== this.key ||
        attestation.round !== this.round ||
        attestation.proposalDigest !== this.proposalDigest
      ) {
        return new InvalidSystemWorkflowError("attestation_mismatch")
      }
      if (
        actorAccountIds.has(attestation.actorAccountId) ||
        representedAccountIds.has(attestation.representedAccountId)
      ) {
        return new InvalidSystemWorkflowError("duplicate_attestation")
      }
      if (!this.candidateAccountIds.includes(attestation.representedAccountId)) {
        return new InvalidSystemWorkflowError("ineligible_decider")
      }

      actorAccountIds.add(attestation.actorAccountId)
      representedAccountIds.add(attestation.representedAccountId)
    }

    if (attestations.some((attestation) => attestation.action === "return")) return "returned"
    const approvalCount = attestations.filter(
      (attestation) => attestation.action === "approve",
    ).length
    const rejectionCount = attestations.filter(
      (attestation) => attestation.action === "reject",
    ).length
    if (
      rejectionCount > 0 &&
      (this.negativeDecisionRule === "any-reject" ||
        rejectionCount > this.candidateAccountIds.length - this.requiredApprovals)
    ) {
      return "rejected"
    }

    return approvalCount >= this.requiredApprovals &&
      representedAccountIds.size >= this.requiredParticipants
      ? "approved"
      : "pending"
  }
}
