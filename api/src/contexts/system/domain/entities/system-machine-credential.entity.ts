import { InvalidSystemPrincipalError } from "@system/domain/errors"
import { z } from "zod"

const propsSchema = z
  .object({
    id: z.string().regex(/^\S{1,255}$/),
    principalId: z.string().regex(/^\S{1,255}$/),
    name: z.string().trim().min(1).max(200),
    secretHash: z.string().regex(/^[0-9a-f]{64}$/),
    status: z.enum(["active", "revoked"]),
    createdAt: z.date(),
    updatedAt: z.date(),
    expiresAt: z.date().nullable(),
    lastUsedAt: z.date().nullable(),
    revokedAt: z.date().nullable(),
  })
  .strict()

type Props = z.output<typeof propsSchema>

/** raw secretを保持せず、機械主体の認証と失効を管理するcredential。 */
export class SystemMachineCredentialEntity {
  readonly id: string
  readonly principalId: string
  readonly name: string
  readonly secretHash: string
  readonly status: Props["status"]
  readonly #createdAtEpochMilliseconds: number
  readonly #updatedAtEpochMilliseconds: number
  readonly #expiresAtEpochMilliseconds: number | null
  readonly #lastUsedAtEpochMilliseconds: number | null
  readonly #revokedAtEpochMilliseconds: number | null

  private constructor(props: Props) {
    this.id = props.id
    this.principalId = props.principalId
    this.name = props.name
    this.secretHash = props.secretHash
    this.status = props.status
    this.#createdAtEpochMilliseconds = props.createdAt.getTime()
    this.#updatedAtEpochMilliseconds = props.updatedAt.getTime()
    this.#expiresAtEpochMilliseconds = props.expiresAt?.getTime() ?? null
    this.#lastUsedAtEpochMilliseconds = props.lastUsedAt?.getTime() ?? null
    this.#revokedAtEpochMilliseconds = props.revokedAt?.getTime() ?? null
    Object.freeze(this)
  }

  static create(input: unknown): SystemMachineCredentialEntity | InvalidSystemPrincipalError {
    const parsed = propsSchema.safeParse(input)
    if (!parsed.success) return new InvalidSystemPrincipalError("invalid_shape", parsed.error)
    if (!hasCanonicalChronology(parsed.data)) {
      return new InvalidSystemPrincipalError("update_before_creation")
    }

    return new SystemMachineCredentialEntity(parsed.data)
  }

  get createdAt(): Date {
    return new Date(this.#createdAtEpochMilliseconds)
  }

  get updatedAt(): Date {
    return new Date(this.#updatedAtEpochMilliseconds)
  }

  get expiresAt(): Date | null {
    return toDate(this.#expiresAtEpochMilliseconds)
  }

  get lastUsedAt(): Date | null {
    return toDate(this.#lastUsedAtEpochMilliseconds)
  }

  get revokedAt(): Date | null {
    return toDate(this.#revokedAtEpochMilliseconds)
  }

  isUsableAt(at: Date): boolean {
    const time = at.getTime()

    return (
      this.status === "active" &&
      Number.isSafeInteger(time) &&
      time >= this.#createdAtEpochMilliseconds &&
      (this.#expiresAtEpochMilliseconds === null || time < this.#expiresAtEpochMilliseconds)
    )
  }

  recordUse(at: Date): SystemMachineCredentialEntity | InvalidSystemPrincipalError {
    if (!this.isUsableAt(at) || at.getTime() < this.#updatedAtEpochMilliseconds) {
      return new InvalidSystemPrincipalError("invalid_transition")
    }

    return SystemMachineCredentialEntity.create({
      ...this.toProps(),
      updatedAt: at,
      lastUsedAt: at,
    })
  }

  revoke(at: Date): SystemMachineCredentialEntity | InvalidSystemPrincipalError {
    if (this.status === "revoked") return this
    if (at.getTime() < this.#updatedAtEpochMilliseconds) {
      return new InvalidSystemPrincipalError("update_before_last_update")
    }

    return SystemMachineCredentialEntity.create({
      ...this.toProps(),
      status: "revoked",
      updatedAt: at,
      revokedAt: at,
    })
  }

  private toProps(): Props {
    return {
      id: this.id,
      principalId: this.principalId,
      name: this.name,
      secretHash: this.secretHash,
      status: this.status,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      expiresAt: this.expiresAt,
      lastUsedAt: this.lastUsedAt,
      revokedAt: this.revokedAt,
    }
  }
}

function toDate(time: number | null): Date | null {
  return time === null ? null : new Date(time)
}

function hasCanonicalChronology(props: Props): boolean {
  const createdAt = props.createdAt.getTime()
  const updatedAt = props.updatedAt.getTime()
  const expiresAt = props.expiresAt?.getTime() ?? null
  const lastUsedAt = props.lastUsedAt?.getTime() ?? null
  const revokedAt = props.revokedAt?.getTime() ?? null
  if (updatedAt < createdAt || (expiresAt !== null && expiresAt <= createdAt)) return false
  if (lastUsedAt !== null && (lastUsedAt < createdAt || lastUsedAt > updatedAt)) return false
  if ((props.status === "revoked") !== (revokedAt !== null)) return false

  return revokedAt === null || (revokedAt >= createdAt && revokedAt === updatedAt)
}
