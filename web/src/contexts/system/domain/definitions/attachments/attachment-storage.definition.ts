import type { AttachmentBytes } from "@system/domain/definitions/attachments/attachment-bytes.definition"

export type AttachmentStorageCommand = Readonly<{
  ownerAccountId: string
  fileName: string
  contentType: string
  content: AttachmentBytes
  now: Date
}>

export type StoredAttachment = Readonly<{
  id: string
  fileName: string
  contentType: string
  byteSize: number
  plaintextSha256: string
  createdAt: Date
}>
