import { InvalidSystemPrincipalError } from "@system/domain/errors"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { z } from "zod"

const propsSchema = z
  .object({
    id: z.string().regex(/^\S{1,255}$/),
    accountId: zAccountId,
    tokenHash: z.string().regex(/^[0-9a-f]{64}$/),
    method: z.enum(["password", "external_identity"]),
    issuedAt: z.date(),
    expiresAt: z.date(),
  })
  .strict()

type Props = z.output<typeof propsSchema>

/** raw tokenを保持せず、Accountと有効期間へ束縛した短命の再認証grant。 */
export class SystemStepUpGrantEntity {
  readonly id: string
  readonly accountId: Props["accountId"]
  readonly tokenHash: string
  readonly method: Props["method"]
  readonly #issuedAtEpochMilliseconds: number
  readonly #expiresAtEpochMilliseconds: number

  private constructor(props: Props) {
    this.id = props.id
    this.accountId = props.accountId
    this.tokenHash = props.tokenHash
    this.method = props.method
    this.#issuedAtEpochMilliseconds = props.issuedAt.getTime()
    this.#expiresAtEpochMilliseconds = props.expiresAt.getTime()
    Object.freeze(this)
  }

  static create(input: unknown): SystemStepUpGrantEntity | InvalidSystemPrincipalError {
    const parsed = propsSchema.safeParse(input)
    if (!parsed.success) return new InvalidSystemPrincipalError("invalid_shape", parsed.error)
    if (parsed.data.expiresAt.getTime() <= parsed.data.issuedAt.getTime()) {
      return new InvalidSystemPrincipalError("invalid_transition")
    }
    return new SystemStepUpGrantEntity(parsed.data)
  }

  get issuedAt(): Date {
    return new Date(this.#issuedAtEpochMilliseconds)
  }

  get expiresAt(): Date {
    return new Date(this.#expiresAtEpochMilliseconds)
  }

  isUsableAt(at: Date): boolean {
    const time = at.getTime()
    return (
      Number.isSafeInteger(time) &&
      time >= this.#issuedAtEpochMilliseconds &&
      time < this.#expiresAtEpochMilliseconds
    )
  }
}
