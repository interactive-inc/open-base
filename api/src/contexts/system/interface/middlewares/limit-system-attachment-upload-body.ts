import { bodyLimit } from "hono/body-limit"
import { ATTACHMENT_MAX_BYTE_SIZE } from "@system/domain/catalogs/attachments/attachment-content.catalog"
import { SystemAttachmentValidationError } from "@system/interface/errors"
import { systemFactory } from "@system/interface/request-environment/system-factory"

/** 添付本体の上限にmultipart境界・header用の64KiBだけを加え、認証後に読み込む。 */
const limit = bodyLimit({
  maxSize: ATTACHMENT_MAX_BYTE_SIZE + 64 * 1024,
  onError: () => {
    throw new SystemAttachmentValidationError({
      code: "attachment_byte_size_exceeded",
      detail: "添付の要求bodyが上限サイズを超えています",
      payloadTooLarge: true,
    })
  },
})

/** 次のhandlerへ渡す前の読取失敗だけを不正な要求として扱う。 */
export const limitSystemAttachmentUploadBody = systemFactory.createMiddleware(
  async (context, next) => {
    const state = { dispatched: false }
    try {
      await limit(context, async () => {
        state.dispatched = true
        await next()
      })
    } catch (cause) {
      if (state.dispatched || cause instanceof SystemAttachmentValidationError) throw cause
      throw new SystemAttachmentValidationError({
        code: "attachment_body_invalid",
        detail: "添付の要求bodyを読み込めません",
      })
    }
  },
)
