import { zAccountId, type AccountId } from "@system/domain/schemas/iam/account-id.schema"
import { InvalidSystemWorkflowError } from "@system/domain/errors"
import {
  proposalDigestSchema,
  type ProposalDigest,
} from "@system/domain/schemas/workflow/system-case-reference.schema"
import {
  humanAttestationIdSchema,
  type HumanAttestationId,
} from "@system/domain/schemas/workflow/human-attestation-id.schema"
import {
  systemCaseIdSchema,
  type SystemCaseId,
} from "@system/domain/schemas/workflow/system-case.schema"
import { z } from "zod"

const propsSchema = z
  .object({
    id: humanAttestationIdSchema,
    caseId: systemCaseIdSchema,
    taskKey: z.string().min(1).max(100),
    round: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    actorAccountId: zAccountId,
    representedAccountId: zAccountId,
    delegationId: z.string().min(1).max(255).nullable(),
    action: z.enum(["approve", "reject", "return"]),
    proposalDigest: proposalDigestSchema,
    comment: z.string().max(4000).nullable(),
    decidedAt: z.date(),
  })
  .strict()

type ParsedProps = z.output<typeof propsSchema>

/** 人間が特定の提案digestへ行った、後から対象を差し替えられない判断証明。 */
export class HumanAttestationEntity {
  readonly id: HumanAttestationId
  readonly caseId: SystemCaseId
  readonly taskKey: string
  readonly round: number
  readonly actorAccountId: AccountId
  readonly representedAccountId: AccountId
  readonly delegationId: string | null
  readonly action: "approve" | "reject" | "return"
  readonly proposalDigest: ProposalDigest
  readonly comment: string | null
  readonly #decidedAtEpochMilliseconds: number

  private constructor(props: ParsedProps) {
    this.id = props.id
    this.caseId = props.caseId
    this.taskKey = props.taskKey
    this.round = props.round
    this.actorAccountId = props.actorAccountId
    this.representedAccountId = props.representedAccountId
    this.delegationId = props.delegationId
    this.action = props.action
    this.proposalDigest = props.proposalDigest
    this.comment = props.comment
    this.#decidedAtEpochMilliseconds = props.decidedAt.getTime()
    Object.freeze(this)
  }

  static create(input: unknown): HumanAttestationEntity | InvalidSystemWorkflowError {
    const parsed = propsSchema.safeParse(input)

    if (!parsed.success) return new InvalidSystemWorkflowError("invalid_shape", parsed.error)
    if (
      parsed.data.actorAccountId !== parsed.data.representedAccountId &&
      parsed.data.delegationId === null
    ) {
      return new InvalidSystemWorkflowError("attestation_mismatch")
    }
    if (
      parsed.data.actorAccountId === parsed.data.representedAccountId &&
      parsed.data.delegationId !== null
    ) {
      return new InvalidSystemWorkflowError("attestation_mismatch")
    }

    return new HumanAttestationEntity(parsed.data)
  }

  get decidedAt(): Date {
    return new Date(this.#decidedAtEpochMilliseconds)
  }
}
