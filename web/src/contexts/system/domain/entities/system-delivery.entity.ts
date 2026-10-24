import { InvalidSystemDeliveryError } from "@system/domain/errors"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { z } from "zod"

const propsSchema = z
  .object({
    id: z.uuid(),
    kind: z.enum(["job", "outbox"]),
    operationKey: z.string().regex(/^[a-z][a-z0-9_.:-]{0,199}$/),
    handlerKey: z
      .string()
      .regex(/^[a-z][a-z0-9_.:-]{0,199}$/)
      .nullable()
      .default(null),
    payloadDigest: z.string().regex(/^[0-9a-f]{64}$/),
    idempotencyKey: z.string().regex(/^\S{1,255}$/),
    status: z.enum(["queued", "leased", "succeeded", "dead_letter"]),
    attempt: z.number().int().min(0).max(100),
    maxAttempts: z.number().int().min(1).max(100),
    availableAt: z.date(),
    leaseAccountId: zAccountId.nullable(),
    leaseTokenHash: z
      .string()
      .regex(/^[0-9a-f]{64}$/)
      .nullable(),
    leaseExpiresAt: z.date().nullable(),
    lastErrorCode: z
      .string()
      .regex(/^[a-z][a-z0-9_.:-]{0,199}$/)
      .nullable(),
    createdAt: z.date(),
    updatedAt: z.date(),
    completedAt: z.date().nullable(),
  })
  .strict()

type Props = z.output<typeof propsSchema>

/** 汎用jobとoutboxに共通するlease・retry・dead-letter lifecycle。 */
export class SystemDeliveryEntity {
  readonly id: string
  readonly kind: Props["kind"]
  readonly operationKey: string
  readonly handlerKey: string | null
  readonly payloadDigest: string
  readonly idempotencyKey: string
  readonly status: Props["status"]
  readonly attempt: number
  readonly maxAttempts: number
  readonly leaseAccountId: Props["leaseAccountId"]
  readonly leaseTokenHash: string | null
  readonly lastErrorCode: string | null
  readonly #availableAt: number
  readonly #leaseExpiresAt: number | null
  readonly #createdAt: number
  readonly #updatedAt: number
  readonly #completedAt: number | null

  private constructor(props: Props) {
    this.id = props.id
    this.kind = props.kind
    this.operationKey = props.operationKey
    this.handlerKey = props.handlerKey
    this.payloadDigest = props.payloadDigest
    this.idempotencyKey = props.idempotencyKey
    this.status = props.status
    this.attempt = props.attempt
    this.maxAttempts = props.maxAttempts
    this.leaseAccountId = props.leaseAccountId
    this.leaseTokenHash = props.leaseTokenHash
    this.lastErrorCode = props.lastErrorCode
    this.#availableAt = props.availableAt.getTime()
    this.#leaseExpiresAt = props.leaseExpiresAt?.getTime() ?? null
    this.#createdAt = props.createdAt.getTime()
    this.#updatedAt = props.updatedAt.getTime()
    this.#completedAt = props.completedAt?.getTime() ?? null
    Object.freeze(this)
  }

  static create(input: unknown): SystemDeliveryEntity | InvalidSystemDeliveryError {
    const parsed = propsSchema.safeParse(input)
    if (!parsed.success) return new InvalidSystemDeliveryError("invalid_shape", parsed.error)
    if (!hasCanonicalState(parsed.data)) {
      return new InvalidSystemDeliveryError("invalid_transition")
    }
    return new SystemDeliveryEntity(parsed.data)
  }

  get availableAt(): Date {
    return new Date(this.#availableAt)
  }

  get leaseExpiresAt(): Date | null {
    return this.#leaseExpiresAt === null ? null : new Date(this.#leaseExpiresAt)
  }

  get createdAt(): Date {
    return new Date(this.#createdAt)
  }

  get updatedAt(): Date {
    return new Date(this.#updatedAt)
  }

  get completedAt(): Date | null {
    return this.#completedAt === null ? null : new Date(this.#completedAt)
  }

  claim(
    leaseAccountId: Props["leaseAccountId"],
    leaseTokenHash: string,
    at: Date,
    leaseMilliseconds: number,
  ): SystemDeliveryEntity | InvalidSystemDeliveryError {
    const time = at.getTime()
    const recoverable =
      this.status === "queued"
        ? time >= this.#availableAt
        : this.status === "leased" && this.#leaseExpiresAt !== null && time >= this.#leaseExpiresAt
    if (
      leaseAccountId === null ||
      !recoverable ||
      this.attempt >= this.maxAttempts ||
      !Number.isSafeInteger(leaseMilliseconds) ||
      leaseMilliseconds < 1_000 ||
      time < this.#updatedAt
    ) {
      return new InvalidSystemDeliveryError("invalid_transition")
    }
    return SystemDeliveryEntity.create({
      ...this.toProps(),
      status: "leased",
      attempt: this.attempt + 1,
      leaseAccountId,
      leaseTokenHash,
      leaseExpiresAt: new Date(time + leaseMilliseconds),
      lastErrorCode: null,
      updatedAt: at,
    })
  }

  heartbeat(
    leaseAccountId: Props["leaseAccountId"],
    leaseTokenHash: string,
    at: Date,
    leaseMilliseconds: number,
  ): SystemDeliveryEntity | InvalidSystemDeliveryError {
    const leaseError = this.verifyLease(leaseAccountId, leaseTokenHash, at)
    if (leaseError !== null) return leaseError
    if (!Number.isSafeInteger(leaseMilliseconds) || leaseMilliseconds < 1_000) {
      return new InvalidSystemDeliveryError("invalid_transition")
    }
    return SystemDeliveryEntity.create({
      ...this.toProps(),
      leaseExpiresAt: new Date(at.getTime() + leaseMilliseconds),
      updatedAt: at,
    })
  }

  succeed(
    leaseAccountId: Props["leaseAccountId"],
    leaseTokenHash: string,
    at: Date,
  ): SystemDeliveryEntity | InvalidSystemDeliveryError {
    const leaseError = this.verifyLease(leaseAccountId, leaseTokenHash, at)
    if (leaseError !== null) return leaseError
    return SystemDeliveryEntity.create({
      ...this.toProps(),
      status: "succeeded",
      leaseAccountId: null,
      leaseTokenHash: null,
      leaseExpiresAt: null,
      lastErrorCode: null,
      updatedAt: at,
      completedAt: at,
    })
  }

  fail(
    leaseAccountId: Props["leaseAccountId"],
    leaseTokenHash: string,
    errorCode: string,
    at: Date,
    retryAt: Date,
  ): SystemDeliveryEntity | InvalidSystemDeliveryError {
    const leaseError = this.verifyLease(leaseAccountId, leaseTokenHash, at)
    if (leaseError !== null) return leaseError
    const terminal = this.attempt >= this.maxAttempts
    if (!terminal && retryAt.getTime() < at.getTime()) {
      return new InvalidSystemDeliveryError("invalid_transition")
    }
    return SystemDeliveryEntity.create({
      ...this.toProps(),
      status: terminal ? "dead_letter" : "queued",
      availableAt: terminal ? this.availableAt : retryAt,
      leaseAccountId: null,
      leaseTokenHash: null,
      leaseExpiresAt: null,
      lastErrorCode: errorCode,
      updatedAt: at,
      completedAt: terminal ? at : null,
    })
  }

  recover(at: Date): SystemDeliveryEntity | InvalidSystemDeliveryError {
    if (
      this.status !== "leased" ||
      this.#leaseExpiresAt === null ||
      at.getTime() < this.#leaseExpiresAt
    ) {
      return new InvalidSystemDeliveryError("invalid_transition")
    }
    const terminal = this.attempt >= this.maxAttempts
    return SystemDeliveryEntity.create({
      ...this.toProps(),
      status: terminal ? "dead_letter" : "queued",
      availableAt: at,
      leaseAccountId: null,
      leaseTokenHash: null,
      leaseExpiresAt: null,
      lastErrorCode: "lease.expired",
      updatedAt: at,
      completedAt: terminal ? at : null,
    })
  }

  private verifyLease(
    leaseAccountId: Props["leaseAccountId"],
    leaseTokenHash: string,
    at: Date,
  ): InvalidSystemDeliveryError | null {
    if (
      this.status !== "leased" ||
      leaseAccountId === null ||
      this.leaseAccountId !== leaseAccountId ||
      this.leaseTokenHash !== leaseTokenHash
    ) {
      return new InvalidSystemDeliveryError("lease_mismatch")
    }
    const time = at.getTime()
    if (this.#leaseExpiresAt === null || time < this.#updatedAt || time >= this.#leaseExpiresAt) {
      return new InvalidSystemDeliveryError("outside_lease")
    }
    return null
  }

  private toProps(): Props {
    return {
      id: this.id,
      kind: this.kind,
      operationKey: this.operationKey,
      handlerKey: this.handlerKey,
      payloadDigest: this.payloadDigest,
      idempotencyKey: this.idempotencyKey,
      status: this.status,
      attempt: this.attempt,
      maxAttempts: this.maxAttempts,
      availableAt: this.availableAt,
      leaseAccountId: this.leaseAccountId,
      leaseTokenHash: this.leaseTokenHash,
      leaseExpiresAt: this.leaseExpiresAt,
      lastErrorCode: this.lastErrorCode,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      completedAt: this.completedAt,
    }
  }
}

function hasCanonicalState(props: Props): boolean {
  const createdAt = props.createdAt.getTime()
  const updatedAt = props.updatedAt.getTime()
  const availableAt = props.availableAt.getTime()
  const leaseExpiresAt = props.leaseExpiresAt?.getTime() ?? null
  const completedAt = props.completedAt?.getTime() ?? null
  const hasLease =
    props.leaseAccountId !== null && props.leaseTokenHash !== null && props.leaseExpiresAt !== null
  if (
    updatedAt < createdAt ||
    availableAt < createdAt ||
    props.attempt > props.maxAttempts ||
    (leaseExpiresAt !== null && leaseExpiresAt <= updatedAt) ||
    (completedAt !== null && completedAt !== updatedAt)
  ) {
    return false
  }
  if (props.status === "leased") return hasLease && completedAt === null
  if (hasLease || completedAt !== (props.status === "queued" ? null : updatedAt)) return false
  if (props.status === "succeeded") return props.lastErrorCode === null
  if (props.status === "dead_letter") return props.lastErrorCode !== null
  return true
}
