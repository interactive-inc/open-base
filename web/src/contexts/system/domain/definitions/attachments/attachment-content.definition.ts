import type { ATTACHMENT_CONTENT_TYPES } from "@system/domain/catalogs/attachments/attachment-content.catalog"

export type AttachmentContentType = (typeof ATTACHMENT_CONTENT_TYPES)[number]

export type AttachmentContentViolation =
  | "content_type_not_allowed"
  | "byte_size_exceeded"
  | "empty_content"
  | "file_name_empty"
  | "file_name_too_long"

export type AttachmentContentInput = Readonly<{
  contentType: string
  byteSize: number
  fileName: string
}>
