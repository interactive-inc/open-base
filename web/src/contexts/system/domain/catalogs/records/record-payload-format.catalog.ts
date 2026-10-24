import { ATTACHMENT_RECORD_MAX_SIZE } from "@system/domain/catalogs/records/attachment-record-format.catalog"

export const RECORD_CONTENT_MAX_SIZE = ATTACHMENT_RECORD_MAX_SIZE

export const RECORD_BINARY_CONTENT_TYPE = "application/vnd.record-preservation+binary"
export const RECORD_BINARY_MAGIC = "RCP2"
export const RECORD_BINARY_PREFIX_SIZE = 8
export const RECORD_BINARY_HEADER_MAX_SIZE = 16 * 1024
export const RECORD_BINARY_MAX_SIZE =
  RECORD_CONTENT_MAX_SIZE + RECORD_BINARY_HEADER_MAX_SIZE + RECORD_BINARY_PREFIX_SIZE
export const RECORD_JSON_MAX_SIZE =
  Math.ceil(RECORD_CONTENT_MAX_SIZE / 3) * 4 + RECORD_BINARY_HEADER_MAX_SIZE
