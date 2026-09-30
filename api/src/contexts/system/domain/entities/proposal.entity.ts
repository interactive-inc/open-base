import { zAccountId, type AccountId } from "@system/domain/schemas/iam/account-id.schema"
import { InvalidSystemProposalError } from "@system/domain/errors"
import {
  procedureKeySchema,
  type ProcedureKey,
} from "@system/domain/schemas/workflow/procedure-key.schema"
import {
  proposalDigestSchema,
  type ProposalDigest,
} from "@system/domain/schemas/workflow/system-case-reference.schema"
import { CanonicalSystemJsonValue } from "@system/domain/values/audit/canonical-system-json.value"
import {
  proposalIdSchema,
  proposalSeriesIdSchema,
  type ProposalId,
  type ProposalSeriesId,
} from "@system/domain/schemas/workflow/proposal-id.schema"
import { ProposalDigestValue } from "@system/domain/values/workflow/proposal-digest.value"
import { z } from "zod"

const propsSchema = z
  .object({
    id: proposalIdSchema,
    seriesId: proposalSeriesIdSchema,
    version: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    procedureKey: procedureKeySchema,
    procedureRevision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    bodyJson: z.string().min(1).max(1_000_000),
    digest: proposalDigestSchema,
    createdByAccountId: zAccountId,
    supersedesProposalId: proposalIdSchema.nullable(),
    createdAt: z.date(),
  })
  .strict()

type ParsedProps = z.output<typeof propsSchema>

/** 人間へ提示する内容と実行内容を同じcanonical JSONとdigestへ固定する提案版。 */
export class ProposalEntity {
  readonly id: ProposalId
  readonly seriesId: ProposalSeriesId
  readonly version: number
  readonly procedureKey: ProcedureKey
  readonly procedureRevision: number
  readonly bodyJson: string
  readonly digest: ProposalDigest
  readonly createdByAccountId: AccountId
  readonly supersedesProposalId: ProposalId | null
  readonly #createdAtEpochMilliseconds: number

  private constructor(props: ParsedProps) {
    this.id = props.id
    this.seriesId = props.seriesId
    this.version = props.version
    this.procedureKey = props.procedureKey
    this.procedureRevision = props.procedureRevision
    this.bodyJson = props.bodyJson
    this.digest = props.digest
    this.createdByAccountId = props.createdByAccountId
    this.supersedesProposalId = props.supersedesProposalId
    this.#createdAtEpochMilliseconds = props.createdAt.getTime()
    Object.freeze(this)
  }

  static async create(input: {
    id: ProposalId
    seriesId: string
    version: number
    procedureKey: string
    procedureRevision: number
    body: unknown
    createdByAccountId: AccountId
    supersedesProposalId: string | null
    createdAt: Date
  }): Promise<ProposalEntity | InvalidSystemProposalError> {
    const body = CanonicalSystemJsonValue.create(input.body)
    if (body instanceof InvalidSystemProposalError) return body
    const digest = await ProposalDigestValue.create(body)
    if (digest instanceof InvalidSystemProposalError) return digest
    const parsed = propsSchema.safeParse({
      id: input.id,
      seriesId: input.seriesId,
      version: input.version,
      procedureKey: input.procedureKey,
      procedureRevision: input.procedureRevision,
      bodyJson: body.toString(),
      digest: digest.toString(),
      createdByAccountId: input.createdByAccountId,
      supersedesProposalId: input.supersedesProposalId,
      createdAt: input.createdAt,
    })

    if (!parsed.success) return new InvalidSystemProposalError("invalid_shape")
    if (!Number.isFinite(parsed.data.createdAt.getTime())) {
      return new InvalidSystemProposalError("invalid_chronology")
    }

    return new ProposalEntity(parsed.data)
  }

  static async restore(input: unknown): Promise<ProposalEntity | InvalidSystemProposalError> {
    const parsed = propsSchema.safeParse(input)
    if (!parsed.success) return new InvalidSystemProposalError("invalid_shape")
    let body: unknown
    try {
      body = JSON.parse(parsed.data.bodyJson)
    } catch (cause) {
      return new InvalidSystemProposalError("invalid_json", { cause })
    }
    const canonical = CanonicalSystemJsonValue.create(body)
    if (
      canonical instanceof InvalidSystemProposalError ||
      canonical.toString() !== parsed.data.bodyJson
    ) {
      return new InvalidSystemProposalError("invalid_json")
    }
    const digest = await ProposalDigestValue.create(canonical)
    if (digest instanceof InvalidSystemProposalError || digest.toString() !== parsed.data.digest) {
      return new InvalidSystemProposalError("digest_mismatch")
    }
    if (!Number.isFinite(parsed.data.createdAt.getTime())) {
      return new InvalidSystemProposalError("invalid_chronology")
    }

    return new ProposalEntity(parsed.data)
  }

  get createdAt(): Date {
    return new Date(this.#createdAtEpochMilliseconds)
  }

  get body(): unknown {
    return JSON.parse(this.bodyJson)
  }
}
