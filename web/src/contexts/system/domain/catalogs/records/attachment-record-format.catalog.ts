import { ATTACHMENT_MAX_BYTE_SIZE } from "@system/domain/catalogs/attachments/attachment-content.catalog"

export const ATTACHMENT_RECORD_FORMAT_ID = "system-attachment-record"
export const ATTACHMENT_RECORD_MAGIC = "ATF1"
export const ATTACHMENT_RECORD_PREFIX_SIZE = 8
export const ATTACHMENT_RECORD_HEADER_MAX_SIZE = 8 * 1024
export const ATTACHMENT_RECORD_MAX_SIZE =
  ATTACHMENT_MAX_BYTE_SIZE + ATTACHMENT_RECORD_PREFIX_SIZE + ATTACHMENT_RECORD_HEADER_MAX_SIZE
