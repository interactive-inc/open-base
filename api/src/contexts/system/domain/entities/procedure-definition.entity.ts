import { zAccountId, type AccountId } from "@system/domain/schemas/iam/account-id.schema"
import { InvalidSystemProposalError } from "@system/domain/errors"
import { CanonicalSystemJsonValue } from "@system/domain/values/audit/canonical-system-json.value"
import {
  procedureKeySchema,
  type ProcedureKey,
} from "@system/domain/schemas/workflow/procedure-key.schema"
import { z } from "zod"

const propsSchema = z
  .object({
    key: procedureKeySchema,
    revision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    title: z.string().min(1).max(500),
    category: z.string().min(1).max(200),
    description: z.string().max(3000).nullable(),
    inputSchemaJson: z.string().min(1).max(1_000_000),
    decisionPolicyJson: z.string().min(1).max(1_000_000),
    completionOperationKey: z.string().min(1).max(100).nullable(),
    createdByAccountId: zAccountId,
    createdAt: z.date(),
  })
  .strict()

type ParsedProps = z.output<typeof propsSchema>

/** 入力契約と判断方針を版単位で固定する、製品非依存の手続定義。 */
export class ProcedureDefinitionEntity {
  readonly key: ProcedureKey
  readonly revision: number
  readonly title: string
  readonly category: string
  readonly description: string | null
  readonly inputSchemaJson: string
  readonly decisionPolicyJson: string
  readonly completionOperationKey: string | null
  readonly createdByAccountId: AccountId
  readonly #createdAtEpochMilliseconds: number

  private constructor(props: ParsedProps) {
    this.key = props.key
    this.revision = props.revision
    this.title = props.title
    this.category = props.category
    this.description = props.description
    this.inputSchemaJson = props.inputSchemaJson
    this.decisionPolicyJson = props.decisionPolicyJson
    this.completionOperationKey = props.completionOperationKey
    this.createdByAccountId = props.createdByAccountId
    this.#createdAtEpochMilliseconds = props.createdAt.getTime()
    Object.freeze(this)
  }

  static create(input: {
    key: string
    revision: number
    title: string
    category: string
    description: string | null
    inputSchema: unknown
    decisionPolicy: unknown
    completionOperationKey: string | null
    createdByAccountId: AccountId
    createdAt: Date
  }): ProcedureDefinitionEntity | InvalidSystemProposalError {
    const inputSchema = CanonicalSystemJsonValue.create(input.inputSchema)
    if (inputSchema instanceof InvalidSystemProposalError) return inputSchema
    const decisionPolicy = CanonicalSystemJsonValue.create(input.decisionPolicy)
    if (decisionPolicy instanceof InvalidSystemProposalError) return decisionPolicy
    const parsed = propsSchema.safeParse({
      key: input.key,
      revision: input.revision,
      title: input.title,
      category: input.category,
      description: input.description,
      inputSchemaJson: inputSchema.toString(),
      decisionPolicyJson: decisionPolicy.toString(),
      completionOperationKey: input.completionOperationKey,
      createdByAccountId: input.createdByAccountId,
      createdAt: input.createdAt,
    })

    if (!parsed.success) return new InvalidSystemProposalError("invalid_shape")
    if (!Number.isFinite(parsed.data.createdAt.getTime())) {
      return new InvalidSystemProposalError("invalid_chronology")
    }

    return new ProcedureDefinitionEntity(parsed.data)
  }

  get createdAt(): Date {
    return new Date(this.#createdAtEpochMilliseconds)
  }
}
