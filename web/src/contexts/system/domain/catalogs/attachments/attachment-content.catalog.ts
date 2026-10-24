/** Systemが保管できる汎用添付のMIME type。業務上の書類種別は各業務contextが所有する。 */
export const ATTACHMENT_CONTENT_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/heic",
] as const

/** 本体はWorkerのメモリ上で暗号化するため、ストリーミング不要な上限に固定する。 */
export const ATTACHMENT_MAX_BYTE_SIZE = 25 * 1024 * 1024

export const ATTACHMENT_MAX_FILE_NAME_LENGTH = 255
