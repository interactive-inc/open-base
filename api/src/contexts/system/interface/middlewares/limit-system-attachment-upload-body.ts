import { bodyLimit } from "hono/body-limit"
import { ATTACHMENT_MAX_BYTE_SIZE } from "@system/domain/catalogs/attachments/attachment-content.catalog"
import { SystemAttachmentValidationError } from "@system/interface/errors"

/** 添付本体の上限にmultipart境界・header用の64KiBだけを加え、認証後に読み込む。 */
export const limitSystemAttachmentUploadBody = bodyLimit({
  maxSize: ATTACHMENT_MAX_BYTE_SIZE + 64 * 1024,
  onError: () => {
    throw new SystemAttachmentValidationError({
      code: "attachment_byte_size_exceeded",
      detail: "添付の要求bodyが上限サイズを超えています",
      payloadTooLarge: true,
    })
  },
})
