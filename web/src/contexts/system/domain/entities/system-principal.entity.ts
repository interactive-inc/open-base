import { InvalidSystemPrincipalError } from "@system/domain/errors"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { z } from "zod"

const propsSchema = z
  .object({
    id: z.string().regex(/^\S{1,255}$/),
    accountId: zAccountId,
    kind: z.enum(["human", "agent", "service", "connector"]),
    name: z.string().trim().min(1).max(200),
    connectorId: z
      .string()
      .regex(/^\S{1,255}$/)
      .nullable(),
    revision: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
    createdAt: z.date(),
    updatedAt: z.date(),
    /** 主キーを UUID へ移す前の値。Entity の同一性には使わない */
    legacyId: z.string().nullable().optional(),
  })
  .strict()

type Props = z.output<typeof propsSchema>

/** 認証Accountを人・Agent・Service・Connectorの操作主体として分類する。 */
export class SystemPrincipalEntity {
  readonly id: string
  readonly accountId: Props["accountId"]
  readonly kind: Props["kind"]
  readonly name: string
  readonly connectorId: string | null
  readonly revision: number
  readonly #createdAtEpochMilliseconds: number
  readonly #updatedAtEpochMilliseconds: number

  private constructor(props: Props) {
    this.id = props.id
    this.accountId = props.accountId
    this.kind = props.kind
    this.name = props.name
    this.connectorId = props.connectorId
    this.revision = props.revision
    this.#createdAtEpochMilliseconds = props.createdAt.getTime()
    this.#updatedAtEpochMilliseconds = props.updatedAt.getTime()
    Object.freeze(this)
  }

  static create(input: unknown): SystemPrincipalEntity | InvalidSystemPrincipalError {
    const parsed = propsSchema.safeParse(input)
    if (!parsed.success) return new InvalidSystemPrincipalError("invalid_shape", parsed.error)
    if ((parsed.data.kind === "connector") !== (parsed.data.connectorId !== null)) {
      return new InvalidSystemPrincipalError("invalid_subject")
    }
    if (parsed.data.updatedAt.getTime() < parsed.data.createdAt.getTime()) {
      return new InvalidSystemPrincipalError("update_before_creation")
    }

    return new SystemPrincipalEntity(parsed.data)
  }

  get createdAt(): Date {
    return new Date(this.#createdAtEpochMilliseconds)
  }

  get updatedAt(): Date {
    return new Date(this.#updatedAtEpochMilliseconds)
  }

  withName(name: string, at: Date): SystemPrincipalEntity | InvalidSystemPrincipalError {
    if (at.getTime() < this.#updatedAtEpochMilliseconds) {
      return new InvalidSystemPrincipalError("update_before_last_update")
    }

    return SystemPrincipalEntity.create({
      id: this.id,
      accountId: this.accountId,
      kind: this.kind,
      name,
      connectorId: this.connectorId,
      revision: this.revision + 1,
      createdAt: this.createdAt,
      updatedAt: at,
    })
  }
}
