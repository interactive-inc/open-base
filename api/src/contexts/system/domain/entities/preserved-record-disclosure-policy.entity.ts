import { preservedRecordDisclosurePolicySchema } from "@system/domain/schemas/records/record-preservation-input.schema"
import { z } from "zod"

const requestSchema = z
  .object({
    recordId: z.uuid(),
    accountId: z.string().regex(/^\S{1,255}$/),
    action: z.enum(["read", "export"]),
    purpose: z.string().min(1).max(255),
    at: z.date(),
  })
  .strict()

type Props = z.output<typeof preservedRecordDisclosurePolicySchema>

/** 保全記録の開示を、明示されたAccount・用途・期間に限定する版付き設定。 */
export class PreservedRecordDisclosurePolicyEntity {
  private constructor(readonly snapshot: Props) {
    Object.freeze(this)
  }

  static create(input: unknown): PreservedRecordDisclosurePolicyEntity | Error {
    const parsed = preservedRecordDisclosurePolicySchema.safeParse(input)
    if (!parsed.success) return parsed.error
    return new PreservedRecordDisclosurePolicyEntity(parsed.data)
  }

  permits(input: unknown): boolean {
    const parsed = requestSchema.safeParse(input)
    if (!parsed.success) return false
    const request = parsed.data
    const at = request.at.getTime()
    if (
      this.snapshot.status !== "active" ||
      this.snapshot.recordId !== request.recordId ||
      Date.parse(this.snapshot.publishedAt) > at
    )
      return false
    return this.snapshot.grants.some(
      (grant) =>
        grant.accountId === request.accountId &&
        grant.actions.includes(request.action) &&
        grant.purposes.includes(request.purpose) &&
        Date.parse(grant.validFrom) <= at &&
        (grant.validUntil === null || at < Date.parse(grant.validUntil)),
    )
  }
}
