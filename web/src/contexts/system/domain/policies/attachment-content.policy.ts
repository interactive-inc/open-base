import {
  ATTACHMENT_CONTENT_TYPES,
  ATTACHMENT_MAX_BYTE_SIZE,
  ATTACHMENT_MAX_FILE_NAME_LENGTH,
} from "@system/domain/catalogs/attachments/attachment-content.catalog"
import type {
  AttachmentContentInput,
  AttachmentContentType,
  AttachmentContentViolation,
} from "@system/domain/definitions/attachments/attachment-content.definition"

function isAttachmentContentType(value: string): value is AttachmentContentType {
  return ATTACHMENT_CONTENT_TYPES.some((contentType) => contentType === value)
}

/** 受け入れ可否を判定する。違反があれば最初の 1 件を返す。 */
export function validateAttachmentContent(
  input: AttachmentContentInput,
): AttachmentContentViolation | null {
  if (!isAttachmentContentType(input.contentType)) return "content_type_not_allowed"

  if (input.byteSize <= 0) return "empty_content"

  if (input.byteSize > ATTACHMENT_MAX_BYTE_SIZE) return "byte_size_exceeded"

  const fileName = input.fileName.trim()

  if (fileName === "") return "file_name_empty"

  if (fileName.length > ATTACHMENT_MAX_FILE_NAME_LENGTH) return "file_name_too_long"

  return null
}
