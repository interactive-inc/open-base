import { z } from "zod"
import { CompanyValidationError } from "@/contexts/company/domain/errors"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

const schema = z
  .object({
    organizationId: z.literal(COMPANY_DEFAULT_ORGANIZATION_ID),
    commandId: z.string().regex(/^\S{1,255}$/),
    actorAccountId: z.string().min(1).max(255),
    reason: z.string().trim().min(1).max(2000),
    recordedAt: z.number().int().nonnegative(),
  })
  .readonly()
type Props = z.infer<typeof schema>
export type WorkforceConnectionCompletionInput = Pick<Props, "commandId" | "reason">

/**
 * 旧会社台帳の従業員と雇用がすべて公開履歴へ接続したことの、会社ごとに一度だけの宣言。
 * 接続の完了は推測せず、この宣言があるときだけ未接続の従業員への発令を拒否へ切り替える。
 */
export class WorkforceConnectionCompletionEntity {
  private constructor(readonly props: Props) {
    Object.freeze(this)
  }

  static create(value: Props): WorkforceConnectionCompletionEntity | CompanyValidationError {
    const parsed = schema.safeParse(value)
    if (!parsed.success || parsed.data.reason.includes("\0"))
      return new CompanyValidationError(
        "接続完了の記録が不正です",
        "invalid_workforce_connection_completion",
        { cause: parsed.success ? undefined : parsed.error },
      )
    return new WorkforceConnectionCompletionEntity(parsed.data)
  }
}
