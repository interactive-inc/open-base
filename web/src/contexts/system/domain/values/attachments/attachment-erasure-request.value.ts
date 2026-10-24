import { SystemAttachmentError } from "@system/domain/errors"
import {
  attachmentErasureRequestBodySchema,
  type AttachmentErasureRequestBody,
  type AttachmentErasureScope,
} from "@system/domain/schemas/attachments/attachment-erasure-request.schema"

export const ATTACHMENT_ERASURE_OPERATION_KEY = "system.attachment.erase"

/**
 * 添付DEKの破棄申請。申請時に破棄対象の添付を固定し、承認digestの対象にする。
 * 申請後に増えた添付は含めず、別の申請を要求する。保全中の添付は対象から外して記録する。
 */
export class AttachmentErasureRequestValue {
  private constructor(readonly body: AttachmentErasureRequestBody) {
    Object.freeze(this)
  }

  static create(
    input: Omit<
      AttachmentErasureRequestBody,
      "operation" | "targetAttachmentIds" | "preservedAttachmentIds"
    > &
      Readonly<{
        targetAttachmentIds: ReadonlyArray<string>
        preservedAttachmentIds: ReadonlyArray<string>
      }>,
  ): AttachmentErasureRequestValue | SystemAttachmentError {
    return AttachmentErasureRequestValue.restore({
      ...input,
      operation: ATTACHMENT_ERASURE_OPERATION_KEY,
      targetAttachmentIds: [...new Set(input.targetAttachmentIds)].sort(),
      preservedAttachmentIds: [...new Set(input.preservedAttachmentIds)].sort(),
    })
  }

  static restore(input: unknown): AttachmentErasureRequestValue | SystemAttachmentError {
    const parsed = attachmentErasureRequestBodySchema.safeParse(input)
    if (!parsed.success)
      return new SystemAttachmentError(
        "validation",
        "attachment_erasure_request_invalid",
        "消去申請の内容が不正です",
      )
    return new AttachmentErasureRequestValue(parsed.data)
  }

  /** 同じ対象への重複申請を見分けるための範囲key。 */
  static scopeKey(scope: AttachmentErasureScope): string {
    return scope.kind === "attachment"
      ? `attachment:${scope.attachmentId}`
      : `account:${scope.accountId}`
  }
}
