import { zAccountId, type AccountId } from "@system/domain/schemas/iam/account-id.schema"
import { InvalidSystemWorkflowError } from "@system/domain/errors"
import {
  proposalDigestSchema,
  systemCaseReferenceSchema,
  type ProposalDigest,
  type SystemCaseReference,
} from "@system/domain/schemas/workflow/system-case-reference.schema"
import {
  systemCaseIdSchema,
  systemCaseStatusSchema,
  type SystemCaseId,
  type SystemCaseStatus,
} from "@system/domain/schemas/workflow/system-case.schema"
import { z } from "zod"

const propsSchema = z
  .object({
    id: systemCaseIdSchema,
    subject: systemCaseReferenceSchema,
    proposalDigest: proposalDigestSchema,
    createdByAccountId: zAccountId,
    status: systemCaseStatusSchema,
    createdAt: z.date(),
    updatedAt: z.date(),
  })
  .strict()

type ParsedProps = z.output<typeof propsSchema>
type CreateInput = Readonly<{
  id: SystemCaseId
  subject: SystemCaseReference
  proposalDigest: ProposalDigest
  createdByAccountId: AccountId
  status: SystemCaseStatus
  createdAt: Date
  updatedAt: Date
}>

/** 業務payloadを持たず、変更不能な対象版と提案digestだけを追跡するSystem案件。 */
export class SystemCaseEntity {
  readonly id: SystemCaseId
  readonly subject: SystemCaseReference
  readonly proposalDigest: ProposalDigest
  readonly createdByAccountId: AccountId
  readonly status: SystemCaseStatus
  readonly #createdAtEpochMilliseconds: number
  readonly #updatedAtEpochMilliseconds: number

  private constructor(props: ParsedProps) {
    this.id = props.id
    this.subject = Object.freeze({
      context: props.subject.context,
      kind: props.subject.kind,
      id: props.subject.id,
      version: props.subject.version,
    })
    this.proposalDigest = props.proposalDigest
    this.createdByAccountId = props.createdByAccountId
    this.status = props.status
    this.#createdAtEpochMilliseconds = props.createdAt.getTime()
    this.#updatedAtEpochMilliseconds = props.updatedAt.getTime()
    Object.freeze(this)
  }

  static create(input: CreateInput): SystemCaseEntity | InvalidSystemWorkflowError {
    const parsed = propsSchema.safeParse(input)

    if (!parsed.success) return new InvalidSystemWorkflowError("invalid_shape", parsed.error)
    if (parsed.data.updatedAt.getTime() < parsed.data.createdAt.getTime()) {
      return new InvalidSystemWorkflowError("invalid_chronology")
    }

    return new SystemCaseEntity(parsed.data)
  }

  get createdAt(): Date {
    return new Date(this.#createdAtEpochMilliseconds)
  }

  get updatedAt(): Date {
    return new Date(this.#updatedAtEpochMilliseconds)
  }

  decide(
    status: "approved" | "rejected" | "returned",
    proposalDigest: ProposalDigest,
    at: Date,
  ): SystemCaseEntity | InvalidSystemWorkflowError {
    const validationError = this.getTransitionError(proposalDigest, at)

    if (validationError !== null) return validationError

    return SystemCaseEntity.create({ ...this.toProps(), status, updatedAt: at })
  }

  cancel(at: Date): SystemCaseEntity | InvalidSystemWorkflowError {
    if (this.status !== "pending") return new InvalidSystemWorkflowError("invalid_transition")
    if (!Number.isFinite(at.getTime()) || at.getTime() < this.#updatedAtEpochMilliseconds) {
      return new InvalidSystemWorkflowError("invalid_chronology")
    }

    return SystemCaseEntity.create({ ...this.toProps(), status: "cancelled", updatedAt: at })
  }

  markExecuted(
    proposalDigest: ProposalDigest,
    at: Date,
  ): SystemCaseEntity | InvalidSystemWorkflowError {
    if (this.status !== "approved") return new InvalidSystemWorkflowError("invalid_transition")

    const validationError = this.getDigestAndTimeError(proposalDigest, at)

    if (validationError !== null) return validationError

    return SystemCaseEntity.create({ ...this.toProps(), status: "executed", updatedAt: at })
  }

  private getTransitionError(
    proposalDigest: ProposalDigest,
    at: Date,
  ): InvalidSystemWorkflowError | null {
    if (this.status !== "pending") return new InvalidSystemWorkflowError("invalid_transition")

    return this.getDigestAndTimeError(proposalDigest, at)
  }

  private getDigestAndTimeError(
    proposalDigest: ProposalDigest,
    at: Date,
  ): InvalidSystemWorkflowError | null {
    if (proposalDigest !== this.proposalDigest) {
      return new InvalidSystemWorkflowError("proposal_digest_mismatch")
    }
    if (!Number.isFinite(at.getTime()) || at.getTime() < this.#updatedAtEpochMilliseconds) {
      return new InvalidSystemWorkflowError("invalid_chronology")
    }

    return null
  }

  private toProps(): ParsedProps {
    return {
      id: this.id,
      subject: { ...this.subject },
      proposalDigest: this.proposalDigest,
      createdByAccountId: this.createdByAccountId,
      status: this.status,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    }
  }
}
