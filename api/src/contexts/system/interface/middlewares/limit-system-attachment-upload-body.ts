import { ATTACHMENT_MAX_BYTE_SIZE } from "@system/domain/catalogs/attachments/attachment-content.catalog"
import { SystemAttachmentValidationError } from "@system/interface/errors"
import { systemFactory } from "@system/interface/request-environment/system-factory"

const maxSize = ATTACHMENT_MAX_BYTE_SIZE + 64 * 1024

/** 認証後に添付bodyを有限量だけ読み、拒否時は入力を終了してreaderを解放する。 */
export const limitSystemAttachmentUploadBody = systemFactory.createMiddleware(
  async (context, next) => {
    const body = context.req.raw.body
    if (body === null) return next()
    const declaredSize = context.req.header("content-length")
    if (
      declaredSize !== undefined &&
      /^\d+$/.test(declaredSize) &&
      Number(declaredSize) > maxSize
    ) {
      void body.cancel().catch(() => undefined)
      throw new SystemAttachmentValidationError({
        code: "attachment_byte_size_exceeded",
        detail: "添付の要求bodyが上限サイズを超えています",
        payloadTooLarge: true,
      })
    }
    const reader = body.getReader()
    const chunks: ArrayBuffer[] = []
    const state = { size: 0 }
    try {
      for (;;) {
        const chunk = await reader.read()
        if (chunk.done) break
        state.size += chunk.value.byteLength
        if (state.size > maxSize) {
          void reader.cancel().catch(() => undefined)
          throw new SystemAttachmentValidationError({
            code: "attachment_byte_size_exceeded",
            detail: "添付の要求bodyが上限サイズを超えています",
            payloadTooLarge: true,
          })
        }
        chunks.push(new Uint8Array(chunk.value).buffer)
      }
    } catch (cause) {
      if (cause instanceof SystemAttachmentValidationError) throw cause
      void reader.cancel().catch(() => undefined)
      throw new SystemAttachmentValidationError({
        code: "attachment_body_invalid",
        detail: "添付の要求bodyを読み込めません",
      })
    } finally {
      reader.releaseLock()
    }
    context.req.raw = new Request(context.req.raw, {
      method: context.req.method,
      body: new Blob(chunks),
    })
    chunks.length = 0
    await next()
  },
)
