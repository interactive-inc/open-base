import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { CanonicalSystemJsonValue } from "@system/domain/values/audit/canonical-system-json.value"
import { ProposalDigestValue } from "@system/domain/values/workflow/proposal-digest.value"
import { z } from "zod"

const identifier = z
  .string()
  .min(1)
  .max(255)
  .refine((value) => !/\s/.test(value))
const schema = z
  .object({
    operationKey: identifier,
    scopeKey: identifier,
    commandId: identifier,
    actorAccountId: zAccountId,
    actorPrincipalId: identifier,
    requestDigest: z
      .string()
      .length(64)
      .regex(/^[0-9a-f]{64}$/),
    recordedAt: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    result: z.unknown(),
  })
  .strict()
type Props = Omit<z.output<typeof schema>, "result"> &
  Readonly<{ resultJson: string; resultDigest: string }>

/** 実行者・入力・確定結果を結び付ける、変更不能な操作完了記録。 */
export class SystemOperationReceiptEntity {
  private constructor(readonly props: Readonly<Props>) {
    Object.freeze(props)
    Object.freeze(this)
  }

  static async create(input: unknown): Promise<SystemOperationReceiptEntity | Error> {
    const parsed = schema.safeParse(input)
    if (!parsed.success) return parsed.error
    const { result, ...props } = parsed.data
    const canonical = CanonicalSystemJsonValue.create(result)
    if (canonical instanceof Error) return canonical
    const digest = await ProposalDigestValue.create(canonical)
    if (digest instanceof Error) return digest
    return new SystemOperationReceiptEntity({
      ...props,
      resultJson: canonical.toString(),
      resultDigest: digest.toString(),
    })
  }
}
