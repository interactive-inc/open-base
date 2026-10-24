import { zAccountId, type AccountId } from "@system/domain/schemas/iam/account-id.schema"
import { InvalidSessionError } from "@system/domain/errors"
import {
  zSessionFamilyId,
  type SessionFamilyId,
} from "@system/domain/schemas/auth/session-family-id.schema"
import { zSessionId, type SessionId } from "@system/domain/schemas/auth/session-id.schema"
import {
  zSessionTokenHash,
  type SessionTokenHash,
} from "@system/domain/schemas/auth/session-token-hash.schema"
import type { SessionUseRejection } from "@system/domain/definitions/auth/session-use-rejection.definition"
import { z } from "zod"

const propsSchema = z
  .object({
    id: zSessionId,
    accountId: zAccountId,
    familyId: zSessionFamilyId,
    tokenHash: zSessionTokenHash,
    tokenVersion: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    authenticatedAt: z.date(),
    createdAt: z.date(),
    expiresAt: z.date(),
    rotatedAt: z.date().nullable(),
    revokedAt: z.date().nullable(),
  })
  .strict()

type ParsedProps = z.output<typeof propsSchema>

/**
 * Accountに属する長期SessionEntity。raw tokenやtransport、業務主体・権限を所有しない。
 * authenticatedAtはfamilyを始めた認証の時刻で、rotationしても引き継ぎ、絶対寿命の起点にする。
 */
export class SessionEntity {
  readonly id: SessionId
  readonly accountId: AccountId
  readonly familyId: SessionFamilyId
  readonly tokenHash: SessionTokenHash
  readonly tokenVersion: number
  readonly #authenticatedAtEpochMilliseconds: number
  readonly #createdAtEpochMilliseconds: number
  readonly #expiresAtEpochMilliseconds: number
  readonly #rotatedAtEpochMilliseconds: number | null
  readonly #revokedAtEpochMilliseconds: number | null

  private constructor(props: ParsedProps) {
    this.id = props.id
    this.accountId = props.accountId
    this.familyId = props.familyId
    this.tokenHash = props.tokenHash
    this.tokenVersion = props.tokenVersion
    this.#authenticatedAtEpochMilliseconds = props.authenticatedAt.getTime()
    this.#createdAtEpochMilliseconds = props.createdAt.getTime()
    this.#expiresAtEpochMilliseconds = props.expiresAt.getTime()
    this.#rotatedAtEpochMilliseconds = props.rotatedAt?.getTime() ?? null
    this.#revokedAtEpochMilliseconds = props.revokedAt?.getTime() ?? null
    Object.freeze(this)
  }

  static create(input: unknown): SessionEntity | InvalidSessionError {
    const parsed = propsSchema.safeParse(input)

    if (!parsed.success) return new InvalidSessionError("invalid_shape", parsed.error)

    const chronologyError = SessionEntity.getChronologyError(parsed.data)

    return chronologyError ?? new SessionEntity(parsed.data)
  }

  get authenticatedAt(): Date {
    return new Date(this.#authenticatedAtEpochMilliseconds)
  }

  /** familyの認証から絶対寿命が尽きる時刻。寿命が不正なら計算できないためnullを返す。 */
  getLifetimeEnd(maxLifetimeMilliseconds: number): Date | null {
    const end = this.#authenticatedAtEpochMilliseconds + maxLifetimeMilliseconds

    return Number.isSafeInteger(maxLifetimeMilliseconds) &&
      maxLifetimeMilliseconds > 0 &&
      Number.isSafeInteger(end)
      ? new Date(end)
      : null
  }

  /** 絶対寿命を過ぎたか、寿命を評価できない場合にtrueを返す。refreshで延長しない。 */
  exceedsLifetime(at: Date, maxLifetimeMilliseconds: number): boolean {
    const end = this.getLifetimeEnd(maxLifetimeMilliseconds)

    return end === null || !Number.isFinite(at.getTime()) || at.getTime() >= end.getTime()
  }

  get createdAt(): Date {
    return new Date(this.#createdAtEpochMilliseconds)
  }

  get expiresAt(): Date {
    return new Date(this.#expiresAtEpochMilliseconds)
  }

  get rotatedAt(): Date | null {
    return this.#rotatedAtEpochMilliseconds === null
      ? null
      : new Date(this.#rotatedAtEpochMilliseconds)
  }

  get revokedAt(): Date | null {
    return this.#revokedAtEpochMilliseconds === null
      ? null
      : new Date(this.#revokedAtEpochMilliseconds)
  }

  getUseRejection(at: Date): SessionUseRejection | null {
    const atEpochMilliseconds = at.getTime()

    if (!Number.isFinite(atEpochMilliseconds)) return "invalid_clock"
    if (atEpochMilliseconds < this.#createdAtEpochMilliseconds) return "not_yet_valid"
    if (
      this.#revokedAtEpochMilliseconds !== null &&
      atEpochMilliseconds >= this.#revokedAtEpochMilliseconds
    ) {
      return "revoked"
    }
    if (
      this.#rotatedAtEpochMilliseconds !== null &&
      atEpochMilliseconds >= this.#rotatedAtEpochMilliseconds
    ) {
      return "rotated"
    }
    if (atEpochMilliseconds >= this.#expiresAtEpochMilliseconds) return "expired"

    return null
  }

  rotate(at: Date): SessionEntity | InvalidSessionError {
    const rejection = this.getUseRejection(at)

    if (rejection !== null) return new InvalidSessionError(rejection)

    return SessionEntity.create({ ...this.toProps(), rotatedAt: at })
  }

  revoke(at: Date): SessionEntity | InvalidSessionError {
    if (this.#revokedAtEpochMilliseconds !== null) {
      const timeError = this.getTransitionTimeError(at, this.#revokedAtEpochMilliseconds)

      return timeError ?? this
    }

    return SessionEntity.create({ ...this.toProps(), revokedAt: at })
  }

  private static getChronologyError(props: ParsedProps): InvalidSessionError | null {
    const authenticatedAt = props.authenticatedAt.getTime()
    const createdAt = props.createdAt.getTime()
    const expiresAt = props.expiresAt.getTime()
    const rotatedAt = props.rotatedAt?.getTime() ?? null
    const revokedAt = props.revokedAt?.getTime() ?? null

    if (!Number.isSafeInteger(authenticatedAt) || authenticatedAt > createdAt) {
      return new InvalidSessionError("authentication_after_creation")
    }
    if (expiresAt <= createdAt) return new InvalidSessionError("expiration_not_after_creation")
    if (rotatedAt !== null && rotatedAt < createdAt) {
      return new InvalidSessionError("rotation_before_creation")
    }
    if (rotatedAt !== null && rotatedAt >= expiresAt) {
      return new InvalidSessionError("rotation_at_or_after_expiration")
    }
    if (revokedAt !== null && revokedAt < createdAt) {
      return new InvalidSessionError("revocation_before_creation")
    }
    if (rotatedAt !== null && revokedAt !== null && revokedAt < rotatedAt) {
      return new InvalidSessionError("revocation_before_rotation")
    }

    return null
  }

  private getTransitionTimeError(at: Date, earliest: number): InvalidSessionError | null {
    if (!Number.isFinite(at.getTime())) return new InvalidSessionError("invalid_clock")
    if (at.getTime() < earliest) {
      return new InvalidSessionError("transition_before_last_update")
    }

    return null
  }

  private toProps(): ParsedProps {
    return {
      id: this.id,
      accountId: this.accountId,
      familyId: this.familyId,
      tokenHash: this.tokenHash,
      tokenVersion: this.tokenVersion,
      authenticatedAt: this.authenticatedAt,
      createdAt: this.createdAt,
      expiresAt: this.expiresAt,
      rotatedAt: this.rotatedAt,
      revokedAt: this.revokedAt,
    }
  }
}
