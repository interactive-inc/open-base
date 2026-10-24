import { zAccountId, type AccountId } from "@system/domain/schemas/iam/account-id.schema"
import {
  identityProviderSchema,
  type IdentityProvider,
} from "@system/domain/schemas/identity/identity-provider.schema"
import { zIdentityId, type IdentityId } from "@system/domain/schemas/identity/identity-id.schema"
import {
  identitySubjectSchema,
  type IdentitySubject,
} from "@system/domain/schemas/identity/identity-subject.schema"
import { InvalidIdentityBindingError } from "@system/domain/errors"
import { z } from "zod"

const propsSchema = z
  .object({
    id: zIdentityId,
    accountId: zAccountId,
    provider: identityProviderSchema,
    subject: identitySubjectSchema,
    createdAt: z.date(),
    activatedAt: z.date().nullable(),
    revokedAt: z.date().nullable(),
  })
  .strict()

type ParsedProps = z.output<typeof propsSchema>

export type IdentityBindingState = "active" | "pending" | "revoked"

/**
 * Accountとprovider subjectのlogin binding。
 * credential secret、連絡先、人物・従業員・組織projectionは所有しない。
 */
export class IdentityBindingEntity {
  readonly id: IdentityId
  readonly accountId: AccountId
  readonly provider: IdentityProvider
  readonly subject: IdentitySubject
  readonly #createdAtEpochMilliseconds: number
  readonly #activatedAtEpochMilliseconds: number | null
  readonly #revokedAtEpochMilliseconds: number | null

  private constructor(props: ParsedProps) {
    this.id = props.id
    this.accountId = props.accountId
    this.provider = props.provider
    this.subject = props.subject
    this.#createdAtEpochMilliseconds = props.createdAt.getTime()
    this.#activatedAtEpochMilliseconds = props.activatedAt?.getTime() ?? null
    this.#revokedAtEpochMilliseconds = props.revokedAt?.getTime() ?? null
    Object.freeze(this)
  }

  static create(input: unknown): IdentityBindingEntity | InvalidIdentityBindingError {
    const parsed = propsSchema.safeParse(input)

    if (!parsed.success) {
      return new InvalidIdentityBindingError("invalid_shape", parsed.error)
    }

    const { createdAt, activatedAt, revokedAt } = parsed.data

    if (activatedAt !== null && activatedAt.getTime() < createdAt.getTime()) {
      return new InvalidIdentityBindingError("activation_before_creation")
    }
    if (revokedAt !== null && revokedAt.getTime() < createdAt.getTime()) {
      return new InvalidIdentityBindingError("revocation_before_creation")
    }
    if (activatedAt !== null && revokedAt !== null && revokedAt.getTime() < activatedAt.getTime()) {
      return new InvalidIdentityBindingError("revocation_before_activation")
    }

    return new IdentityBindingEntity(parsed.data)
  }

  get state(): IdentityBindingState {
    if (this.#revokedAtEpochMilliseconds !== null) return "revoked"
    return this.#activatedAtEpochMilliseconds === null ? "pending" : "active"
  }

  get createdAt(): Date {
    return new Date(this.#createdAtEpochMilliseconds)
  }

  get activatedAt(): Date | null {
    return this.#activatedAtEpochMilliseconds === null
      ? null
      : new Date(this.#activatedAtEpochMilliseconds)
  }

  get revokedAt(): Date | null {
    return this.#revokedAtEpochMilliseconds === null
      ? null
      : new Date(this.#revokedAtEpochMilliseconds)
  }

  activate(at: Date): IdentityBindingEntity | InvalidIdentityBindingError {
    if (this.state === "revoked") {
      return new InvalidIdentityBindingError("revoked_identity_activation")
    }
    if (this.state === "active") return this

    return IdentityBindingEntity.create({ ...this.toProps(), activatedAt: at })
  }

  revoke(at: Date): IdentityBindingEntity | InvalidIdentityBindingError {
    if (this.state === "revoked") return this

    return IdentityBindingEntity.create({ ...this.toProps(), revokedAt: at })
  }

  wasActiveAt(at: Date): boolean {
    const atEpochMilliseconds = at.getTime()

    return (
      Number.isFinite(atEpochMilliseconds) &&
      this.#activatedAtEpochMilliseconds !== null &&
      atEpochMilliseconds >= this.#activatedAtEpochMilliseconds &&
      (this.#revokedAtEpochMilliseconds === null ||
        atEpochMilliseconds < this.#revokedAtEpochMilliseconds)
    )
  }

  private toProps(): ParsedProps {
    return {
      id: this.id,
      accountId: this.accountId,
      provider: this.provider,
      subject: this.subject,
      createdAt: this.createdAt,
      activatedAt: this.activatedAt,
      revokedAt: this.revokedAt,
    }
  }
}
