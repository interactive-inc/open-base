import { InvalidSystemIntegrationError } from "@system/domain/errors"
import { z } from "zod"

const digestSchema = z.string().regex(/^[0-9a-f]{64}$/u)
const itemInputSchema = z
  .object({
    key: z.string().trim().min(1).max(512),
    localDigest: digestSchema.nullable(),
    externalDigest: digestSchema.nullable(),
  })
  .strict()
const runInputSchema = z
  .object({
    id: z.string().regex(/^\S{1,255}$/),
    exchangeId: z.string().regex(/^\S{1,255}$/),
    assertionId: z.string().regex(/^\S{1,255}$/),
    localVersion: z.string().trim().min(1).max(255),
    createdAt: z.date(),
    items: z.array(itemInputSchema).min(1).max(10_000),
  })
  .strict()

type ItemInput = z.output<typeof itemInputSchema>
export type ReconciliationItem = Readonly<
  ItemInput & { status: "matched" | "different" | "missing_local" | "missing_external" }
>

/** semantic key単位の差分と根拠versionを固定する照合結果。 */
export class ReconciliationRunEntity {
  readonly id: string
  readonly exchangeId: string
  readonly assertionId: string
  readonly localVersion: string
  readonly status: "matched" | "mismatched"
  readonly items: ReadonlyArray<ReconciliationItem>
  readonly #createdAtEpochMilliseconds: number

  private constructor(
    props: Omit<z.output<typeof runInputSchema>, "items"> &
      Readonly<{ items: ReadonlyArray<ReconciliationItem> }>,
  ) {
    this.id = props.id
    this.exchangeId = props.exchangeId
    this.assertionId = props.assertionId
    this.localVersion = props.localVersion
    this.items = Object.freeze(props.items.map((item) => Object.freeze({ ...item })))
    this.status = this.items.every((item) => item.status === "matched") ? "matched" : "mismatched"
    this.#createdAtEpochMilliseconds = props.createdAt.getTime()
    Object.freeze(this)
  }

  static create(input: unknown): ReconciliationRunEntity | InvalidSystemIntegrationError {
    const parsed = runInputSchema.safeParse(input)
    if (!parsed.success) return new InvalidSystemIntegrationError("invalid_shape", parsed.error)
    if (new Set(parsed.data.items.map((item) => item.key)).size !== parsed.data.items.length) {
      return new InvalidSystemIntegrationError("duplicate_item")
    }
    return new ReconciliationRunEntity({
      ...parsed.data,
      items: parsed.data.items.map(toReconciliationItem),
    })
  }

  get createdAt(): Date {
    return new Date(this.#createdAtEpochMilliseconds)
  }
}

function toReconciliationItem(item: ItemInput): ReconciliationItem {
  if (item.localDigest === null) return { ...item, status: "missing_local" }
  if (item.externalDigest === null) return { ...item, status: "missing_external" }
  return { ...item, status: item.localDigest === item.externalDigest ? "matched" : "different" }
}
