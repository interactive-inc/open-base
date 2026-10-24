import { InvalidSystemIntegrationError } from "@system/domain/errors"
import { z } from "zod"

const assertionPropsSchema = z
  .object({
    id: z.string().regex(/^\S{1,255}$/),
    connectorId: z.string().regex(/^\S{1,255}$/),
    exchangeId: z
      .string()
      .regex(/^\S{1,255}$/)
      .nullable(),
    externalKey: z.string().trim().min(1).max(512),
    externalVersion: z.string().trim().min(1).max(255),
    payloadDigest: z.string().regex(/^[0-9a-f]{64}$/u),
    observedAt: z.date(),
    receivedAt: z.date(),
  })
  .strict()

type AssertionProps = z.output<typeof assertionPropsSchema>

/** 外部側が表明したsemantic key・version・digestのimmutable evidence。 */
export class ExternalAssertionEntity {
  readonly id: string
  readonly connectorId: string
  readonly exchangeId: string | null
  readonly externalKey: string
  readonly externalVersion: string
  readonly payloadDigest: string
  readonly #observedAtEpochMilliseconds: number
  readonly #receivedAtEpochMilliseconds: number

  private constructor(props: AssertionProps) {
    this.id = props.id
    this.connectorId = props.connectorId
    this.exchangeId = props.exchangeId
    this.externalKey = props.externalKey
    this.externalVersion = props.externalVersion
    this.payloadDigest = props.payloadDigest
    this.#observedAtEpochMilliseconds = props.observedAt.getTime()
    this.#receivedAtEpochMilliseconds = props.receivedAt.getTime()
    Object.freeze(this)
  }

  static create(input: unknown): ExternalAssertionEntity | InvalidSystemIntegrationError {
    const parsed = assertionPropsSchema.safeParse(input)
    if (!parsed.success) return new InvalidSystemIntegrationError("invalid_shape", parsed.error)
    if (parsed.data.receivedAt.getTime() < parsed.data.observedAt.getTime()) {
      return new InvalidSystemIntegrationError("update_before_creation")
    }
    return new ExternalAssertionEntity(parsed.data)
  }

  get observedAt(): Date {
    return new Date(this.#observedAtEpochMilliseconds)
  }

  get receivedAt(): Date {
    return new Date(this.#receivedAtEpochMilliseconds)
  }
}
