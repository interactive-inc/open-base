import { z } from "zod"
import { proposalDigestSchema } from "@system/domain/schemas/workflow/system-case-reference.schema"
import { InvalidSystemWorkflowError } from "@system/domain/errors"

const propsSchema = z
  .object({
    proposalVersion: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    proposalDigest: proposalDigestSchema,
    taskKey: z.string().min(1).max(100),
    taskRound: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  })
  .strict()
type Props = Readonly<z.output<typeof propsSchema>>

/** 利用者が確認した提案版と判断段階を、現在の処理対象へ結び付ける。 */
export class SystemDecisionTargetValue {
  private constructor(private readonly props: Props) {
    Object.freeze(props)
    Object.freeze(this)
  }

  static create(input: unknown): SystemDecisionTargetValue | InvalidSystemWorkflowError {
    const parsed = propsSchema.safeParse(input)
    if (!parsed.success)
      return new InvalidSystemWorkflowError("invalid_shape", { cause: parsed.error })
    return new SystemDecisionTargetValue(parsed.data)
  }

  equals(other: SystemDecisionTargetValue): boolean {
    return (
      this.props.proposalVersion === other.props.proposalVersion &&
      this.props.proposalDigest === other.props.proposalDigest &&
      this.props.taskKey === other.props.taskKey &&
      this.props.taskRound === other.props.taskRound
    )
  }
}
