import { zAccountId, type AccountId } from "@system/domain/schemas/iam/account-id.schema"
import { InvalidSystemWorkflowError } from "@system/domain/errors"
import {
  proposalDigestSchema,
  type ProposalDigest,
} from "@system/domain/schemas/workflow/system-case-reference.schema"
import { z } from "zod"

const propsSchema = z
  .object({
    accountId: zAccountId,
    source: z.enum(["primary", "escalation"]),
    evidenceContext: z.string().min(1).max(100),
    evidenceKind: z.string().min(1).max(100),
    evidenceId: z.string().min(1).max(512),
    evidenceVersion: z.string().min(1).max(255),
    eligibilityDigest: proposalDigestSchema,
    eligibleFrom: z.date().nullable(),
    resolvedAt: z.date(),
  })
  .strict()

type ParsedProps = z.output<typeof propsSchema>

/** 資格所有元が解決し、Systemが意味を解釈せず固定する判断候補証拠。 */
export class DecisionTaskCandidateEntity {
  readonly accountId: AccountId
  readonly source: "primary" | "escalation"
  readonly evidenceContext: string
  readonly evidenceKind: string
  readonly evidenceId: string
  readonly evidenceVersion: string
  readonly eligibilityDigest: ProposalDigest
  readonly #eligibleFromEpochMilliseconds: number | null
  readonly #resolvedAtEpochMilliseconds: number

  private constructor(props: ParsedProps) {
    this.accountId = props.accountId
    this.source = props.source
    this.evidenceContext = props.evidenceContext
    this.evidenceKind = props.evidenceKind
    this.evidenceId = props.evidenceId
    this.evidenceVersion = props.evidenceVersion
    this.eligibilityDigest = props.eligibilityDigest
    this.#eligibleFromEpochMilliseconds = props.eligibleFrom?.getTime() ?? null
    this.#resolvedAtEpochMilliseconds = props.resolvedAt.getTime()
    Object.freeze(this)
  }

  static create(input: unknown): DecisionTaskCandidateEntity | InvalidSystemWorkflowError {
    const parsed = propsSchema.safeParse(input)
    if (!parsed.success) return new InvalidSystemWorkflowError("invalid_shape", parsed.error)
    const resolvedAt = parsed.data.resolvedAt.getTime()
    const eligibleFrom = parsed.data.eligibleFrom?.getTime() ?? null
    if (
      !Number.isFinite(resolvedAt) ||
      (parsed.data.source === "primary" && eligibleFrom !== null) ||
      (parsed.data.source === "escalation" && eligibleFrom === null) ||
      (eligibleFrom !== null && (!Number.isFinite(eligibleFrom) || eligibleFrom < resolvedAt))
    ) {
      return new InvalidSystemWorkflowError("invalid_chronology")
    }

    return new DecisionTaskCandidateEntity(parsed.data)
  }

  get eligibleFrom(): Date | null {
    return this.#eligibleFromEpochMilliseconds === null
      ? null
      : new Date(this.#eligibleFromEpochMilliseconds)
  }

  get resolvedAt(): Date {
    return new Date(this.#resolvedAtEpochMilliseconds)
  }
}
