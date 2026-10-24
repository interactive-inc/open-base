import { zAccountId, type AccountId } from "@system/domain/schemas/iam/account-id.schema"
import { InvalidSystemWorkflowError } from "@system/domain/errors"
import {
  systemCaseReferenceSchema,
  type SystemCaseReference,
} from "@system/domain/schemas/workflow/system-case-reference.schema"
import {
  delegationIdSchema,
  type DelegationId,
} from "@system/domain/schemas/workflow/delegation-id.schema"
import { z } from "zod"

const propsSchema = z
  .object({
    id: delegationIdSchema,
    delegatorAccountId: zAccountId,
    delegateAccountId: zAccountId,
    scope: systemCaseReferenceSchema.nullable(),
    startsAt: z.date(),
    endsAt: z.date(),
    createdAt: z.date(),
    revokedAt: z.date().nullable(),
  })
  .strict()

type ParsedProps = z.output<typeof propsSchema>

/** Principal間の限定代理。会社上の権限そのものや継続責任を移転しない。 */
export class DelegationEntity {
  readonly id: DelegationId
  readonly delegatorAccountId: AccountId
  readonly delegateAccountId: AccountId
  readonly scope: SystemCaseReference | null
  readonly #startsAtEpochMilliseconds: number
  readonly #endsAtEpochMilliseconds: number
  readonly #createdAtEpochMilliseconds: number
  readonly #revokedAtEpochMilliseconds: number | null

  private constructor(props: ParsedProps) {
    this.id = props.id
    this.delegatorAccountId = props.delegatorAccountId
    this.delegateAccountId = props.delegateAccountId
    this.scope = props.scope === null ? null : Object.freeze({ ...props.scope })
    this.#startsAtEpochMilliseconds = props.startsAt.getTime()
    this.#endsAtEpochMilliseconds = props.endsAt.getTime()
    this.#createdAtEpochMilliseconds = props.createdAt.getTime()
    this.#revokedAtEpochMilliseconds = props.revokedAt?.getTime() ?? null
    Object.freeze(this)
  }

  static create(input: unknown): DelegationEntity | InvalidSystemWorkflowError {
    const parsed = propsSchema.safeParse(input)

    if (!parsed.success) return new InvalidSystemWorkflowError("invalid_shape", parsed.error)
    if (parsed.data.delegatorAccountId === parsed.data.delegateAccountId) {
      return new InvalidSystemWorkflowError("delegation_to_self")
    }
    if (
      parsed.data.endsAt.getTime() <= parsed.data.startsAt.getTime() ||
      parsed.data.createdAt.getTime() > parsed.data.startsAt.getTime() ||
      (parsed.data.revokedAt !== null &&
        (parsed.data.revokedAt.getTime() < parsed.data.createdAt.getTime() ||
          parsed.data.revokedAt.getTime() > parsed.data.endsAt.getTime()))
    ) {
      return new InvalidSystemWorkflowError("invalid_chronology")
    }

    return new DelegationEntity(parsed.data)
  }

  get createdAt(): Date {
    return new Date(this.#createdAtEpochMilliseconds)
  }

  isActiveAt(at: Date, scope: SystemCaseReference): boolean {
    const atEpochMilliseconds = at.getTime()

    if (!Number.isFinite(atEpochMilliseconds)) return false
    if (atEpochMilliseconds < this.#startsAtEpochMilliseconds) return false
    if (atEpochMilliseconds >= this.#endsAtEpochMilliseconds) return false
    if (
      this.#revokedAtEpochMilliseconds !== null &&
      atEpochMilliseconds >= this.#revokedAtEpochMilliseconds
    ) {
      return false
    }
    if (this.scope === null) return true

    return (
      this.scope.context === scope.context &&
      this.scope.kind === scope.kind &&
      this.scope.id === scope.id &&
      this.scope.version === scope.version
    )
  }
}
