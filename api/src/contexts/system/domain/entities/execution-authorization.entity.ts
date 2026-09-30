import { zAccountId, type AccountId } from "@system/domain/schemas/iam/account-id.schema"
import { InvalidSystemWorkflowError } from "@system/domain/errors"
import {
  proposalDigestSchema,
  type ProposalDigest,
} from "@system/domain/schemas/workflow/system-case-reference.schema"
import {
  executionAuthorizationIdSchema,
  type ExecutionAuthorizationId,
} from "@system/domain/schemas/workflow/execution-authorization-id.schema"
import {
  systemCaseIdSchema,
  type SystemCaseId,
} from "@system/domain/schemas/workflow/system-case.schema"
import { z } from "zod"

const propsSchema = z
  .object({
    id: executionAuthorizationIdSchema,
    caseId: systemCaseIdSchema,
    operationKey: z.string().min(1).max(100),
    proposalDigest: proposalDigestSchema,
    grantedToAccountId: zAccountId,
    grantedAt: z.date(),
    expiresAt: z.date(),
    usedAt: z.date().nullable(),
  })
  .strict()

type ParsedProps = z.output<typeof propsSchema>

/** 承認済み提案digestにだけ使える、期限付きかつ一回限りのSystem実行許可。 */
export class ExecutionAuthorizationEntity {
  readonly id: ExecutionAuthorizationId
  readonly caseId: SystemCaseId
  readonly operationKey: string
  readonly proposalDigest: ProposalDigest
  readonly grantedToAccountId: AccountId
  readonly #grantedAtEpochMilliseconds: number
  readonly #expiresAtEpochMilliseconds: number
  readonly #usedAtEpochMilliseconds: number | null

  private constructor(props: ParsedProps) {
    this.id = props.id
    this.caseId = props.caseId
    this.operationKey = props.operationKey
    this.proposalDigest = props.proposalDigest
    this.grantedToAccountId = props.grantedToAccountId
    this.#grantedAtEpochMilliseconds = props.grantedAt.getTime()
    this.#expiresAtEpochMilliseconds = props.expiresAt.getTime()
    this.#usedAtEpochMilliseconds = props.usedAt?.getTime() ?? null
    Object.freeze(this)
  }

  static create(input: unknown): ExecutionAuthorizationEntity | InvalidSystemWorkflowError {
    const parsed = propsSchema.safeParse(input)

    if (!parsed.success) return new InvalidSystemWorkflowError("invalid_shape", parsed.error)
    if (parsed.data.expiresAt.getTime() <= parsed.data.grantedAt.getTime()) {
      return new InvalidSystemWorkflowError("invalid_chronology")
    }
    if (
      parsed.data.usedAt !== null &&
      (parsed.data.usedAt.getTime() < parsed.data.grantedAt.getTime() ||
        parsed.data.usedAt.getTime() >= parsed.data.expiresAt.getTime())
    ) {
      return new InvalidSystemWorkflowError("invalid_chronology")
    }

    return new ExecutionAuthorizationEntity(parsed.data)
  }

  get grantedAt(): Date {
    return new Date(this.#grantedAtEpochMilliseconds)
  }

  get expiresAt(): Date {
    return new Date(this.#expiresAtEpochMilliseconds)
  }

  get usedAt(): Date | null {
    return this.#usedAtEpochMilliseconds === null ? null : new Date(this.#usedAtEpochMilliseconds)
  }

  use(
    proposalDigest: ProposalDigest,
    at: Date,
  ): ExecutionAuthorizationEntity | InvalidSystemWorkflowError {
    if (this.#usedAtEpochMilliseconds !== null) {
      return new InvalidSystemWorkflowError("authorization_already_used")
    }
    if (proposalDigest !== this.proposalDigest) {
      return new InvalidSystemWorkflowError("proposal_digest_mismatch")
    }

    const atEpochMilliseconds = at.getTime()

    if (
      !Number.isFinite(atEpochMilliseconds) ||
      atEpochMilliseconds < this.#grantedAtEpochMilliseconds
    ) {
      return new InvalidSystemWorkflowError("invalid_chronology")
    }
    if (atEpochMilliseconds >= this.#expiresAtEpochMilliseconds) {
      return new InvalidSystemWorkflowError("authorization_expired")
    }

    return ExecutionAuthorizationEntity.create({ ...this.toProps(), usedAt: at })
  }

  private toProps(): ParsedProps {
    return {
      id: this.id,
      caseId: this.caseId,
      operationKey: this.operationKey,
      proposalDigest: this.proposalDigest,
      grantedToAccountId: this.grantedToAccountId,
      grantedAt: new Date(this.#grantedAtEpochMilliseconds),
      expiresAt: new Date(this.#expiresAtEpochMilliseconds),
      usedAt:
        this.#usedAtEpochMilliseconds === null ? null : new Date(this.#usedAtEpochMilliseconds),
    }
  }
}
