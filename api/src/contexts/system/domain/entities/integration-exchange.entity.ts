import { InvalidSystemIntegrationError } from "@system/domain/errors"
import { z } from "zod"

const digestSchema = z.string().regex(/^[0-9a-f]{64}$/u)
const exchangePropsSchema = z
  .object({
    id: z.string().regex(/^\S{1,255}$/),
    connectorId: z.string().regex(/^\S{1,255}$/),
    direction: z.enum(["inbound", "outbound"]),
    operationKey: z.string().regex(/^[a-z][a-z0-9_.:-]{0,199}$/u),
    idempotencyKey: z.string().regex(/^\S{1,255}$/),
    payloadDigest: digestSchema,
    status: z.enum(["pending", "succeeded", "failed", "cancelled"]),
    attempt: z.number().int().min(1).max(100),
    externalReference: z.string().trim().min(1).max(512).nullable(),
    lastErrorCode: z
      .string()
      .regex(/^[a-z][a-z0-9_.:-]{0,199}$/u)
      .nullable(),
    createdAt: z.date(),
    updatedAt: z.date(),
    completedAt: z.date().nullable(),
  })
  .strict()

type ExchangeProps = z.output<typeof exchangePropsSchema>

/** payloadを保持せずdigest・試行・結果を追跡する外部交換。 */
export class IntegrationExchangeEntity {
  readonly id: string
  readonly connectorId: string
  readonly direction: ExchangeProps["direction"]
  readonly operationKey: string
  readonly idempotencyKey: string
  readonly payloadDigest: string
  readonly status: ExchangeProps["status"]
  readonly attempt: number
  readonly externalReference: string | null
  readonly lastErrorCode: string | null
  readonly #createdAtEpochMilliseconds: number
  readonly #updatedAtEpochMilliseconds: number
  readonly #completedAtEpochMilliseconds: number | null

  private constructor(props: ExchangeProps) {
    this.id = props.id
    this.connectorId = props.connectorId
    this.direction = props.direction
    this.operationKey = props.operationKey
    this.idempotencyKey = props.idempotencyKey
    this.payloadDigest = props.payloadDigest
    this.status = props.status
    this.attempt = props.attempt
    this.externalReference = props.externalReference
    this.lastErrorCode = props.lastErrorCode
    this.#createdAtEpochMilliseconds = props.createdAt.getTime()
    this.#updatedAtEpochMilliseconds = props.updatedAt.getTime()
    this.#completedAtEpochMilliseconds = props.completedAt?.getTime() ?? null
    Object.freeze(this)
  }

  static create(input: unknown): IntegrationExchangeEntity | InvalidSystemIntegrationError {
    const parsed = exchangePropsSchema.safeParse(input)
    if (!parsed.success) return new InvalidSystemIntegrationError("invalid_shape", parsed.error)
    if (!hasCanonicalChronology(parsed.data)) {
      return new InvalidSystemIntegrationError("update_before_creation")
    }
    return new IntegrationExchangeEntity(parsed.data)
  }

  get createdAt(): Date {
    return new Date(this.#createdAtEpochMilliseconds)
  }

  get updatedAt(): Date {
    return new Date(this.#updatedAtEpochMilliseconds)
  }

  get completedAt(): Date | null {
    return this.#completedAtEpochMilliseconds === null
      ? null
      : new Date(this.#completedAtEpochMilliseconds)
  }

  transition(
    nextStatus: ExchangeProps["status"],
    at: Date,
    details: Readonly<{ externalReference: string | null; errorCode: string | null }>,
  ): IntegrationExchangeEntity | InvalidSystemIntegrationError {
    if (!isAllowedTransition(this.status, nextStatus)) {
      return new InvalidSystemIntegrationError("invalid_transition")
    }
    if (at.getTime() < this.#updatedAtEpochMilliseconds) {
      return new InvalidSystemIntegrationError("update_before_last_update")
    }
    return IntegrationExchangeEntity.create({
      ...this.toProps(),
      status: nextStatus,
      attempt: nextStatus === "pending" ? this.attempt + 1 : this.attempt,
      externalReference: details.externalReference,
      lastErrorCode: details.errorCode,
      updatedAt: at,
      completedAt: nextStatus === "pending" ? null : at,
    })
  }

  private toProps(): ExchangeProps {
    return {
      id: this.id,
      connectorId: this.connectorId,
      direction: this.direction,
      operationKey: this.operationKey,
      idempotencyKey: this.idempotencyKey,
      payloadDigest: this.payloadDigest,
      status: this.status,
      attempt: this.attempt,
      externalReference: this.externalReference,
      lastErrorCode: this.lastErrorCode,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      completedAt: this.completedAt,
    }
  }
}

function hasCanonicalChronology(props: ExchangeProps): boolean {
  const createdAt = props.createdAt.getTime()
  const updatedAt = props.updatedAt.getTime()
  const completedAt = props.completedAt?.getTime() ?? null
  if (updatedAt < createdAt) return false
  if ((props.status === "pending") !== (completedAt === null)) return false
  return completedAt === null || completedAt >= createdAt
}

function isAllowedTransition(
  current: ExchangeProps["status"],
  next: ExchangeProps["status"],
): boolean {
  if (current === "pending") return next !== "pending"
  if (current === "failed") return next === "pending"
  return false
}
