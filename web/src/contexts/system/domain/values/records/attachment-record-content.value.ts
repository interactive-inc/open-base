import { z } from "zod"
import { attachmentEvidenceSchema } from "@system/domain/definitions/attachments/attachment-evidence.definition"
import { ATTACHMENT_MAX_BYTE_SIZE } from "@system/domain/catalogs/attachments/attachment-content.catalog"
import {
  ATTACHMENT_RECORD_MAGIC,
  ATTACHMENT_RECORD_PREFIX_SIZE,
  ATTACHMENT_RECORD_HEADER_MAX_SIZE,
  ATTACHMENT_RECORD_MAX_SIZE,
} from "@system/domain/catalogs/records/attachment-record-format.catalog"

const metadataSchema = attachmentEvidenceSchema
  .extend({
    ownerAccountId: z
      .string()
      .min(1)
      .max(255)
      .refine((value) => value.trim().length > 0),
    createdAt: z.string().datetime(),
    linkedAt: z.string().datetime(),
  })
  .strict()
const headerSchema = z.strictObject({ version: z.literal(1), attachment: metadataSchema })
type Metadata = z.output<typeof metadataSchema>

/** 元添付の識別・名前・形式・所有者・日時と全バイトを、一つの保全本文へ固定する。 */
export class AttachmentRecordContentValue {
  readonly #content: Uint8Array<ArrayBuffer>

  private constructor(
    readonly metadata: Readonly<Metadata>,
    content: Uint8Array<ArrayBuffer>,
  ) {
    this.#content = content
    Object.freeze(this)
  }

  static async create(
    input: unknown,
    bytes: Uint8Array,
  ): Promise<AttachmentRecordContentValue | Error> {
    const parsed = metadataSchema.safeParse(input)
    if (!parsed.success) return parsed.error
    const metadata = parsed.data
    if (
      bytes.byteLength === 0 ||
      bytes.byteLength > ATTACHMENT_MAX_BYTE_SIZE ||
      bytes.byteLength !== metadata.byteSize ||
      Date.parse(metadata.createdAt) > Date.parse(metadata.linkedAt)
    )
      return new Error("attachment record size or chronology differs")
    const content = new Uint8Array(bytes)
    const digest = [...new Uint8Array(await crypto.subtle.digest("SHA-256", content))]
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("")
    if (digest !== metadata.sha256) return new Error("attachment record content differs")
    return new AttachmentRecordContentValue(Object.freeze(metadata), content)
  }

  toBytes(): Uint8Array<ArrayBuffer> | Error {
    const header = new TextEncoder().encode(
      JSON.stringify({ version: 1, attachment: this.metadata }),
    )
    if (header.byteLength > ATTACHMENT_RECORD_HEADER_MAX_SIZE)
      return new Error("attachment metadata too large")
    const bytes = new Uint8Array(
      ATTACHMENT_RECORD_PREFIX_SIZE + header.byteLength + this.#content.byteLength,
    )
    bytes.set(new TextEncoder().encode(ATTACHMENT_RECORD_MAGIC))
    new DataView(bytes.buffer).setUint32(4, header.byteLength, false)
    bytes.set(header, ATTACHMENT_RECORD_PREFIX_SIZE)
    bytes.set(this.#content, ATTACHMENT_RECORD_PREFIX_SIZE + header.byteLength)
    return bytes
  }

  contentBytes(): Uint8Array<ArrayBuffer> {
    return new Uint8Array(this.#content)
  }

  static async restore(bytes: Uint8Array): Promise<AttachmentRecordContentValue | Error> {
    if (
      bytes.byteLength < ATTACHMENT_RECORD_PREFIX_SIZE ||
      bytes.byteLength > ATTACHMENT_RECORD_MAX_SIZE
    )
      return new Error("invalid attachment record size")
    try {
      if (new TextDecoder().decode(bytes.subarray(0, 4)) !== ATTACHMENT_RECORD_MAGIC)
        return new Error("invalid attachment record signature")
      const size = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(
        4,
        false,
      )
      if (
        size === 0 ||
        size > ATTACHMENT_RECORD_HEADER_MAX_SIZE ||
        ATTACHMENT_RECORD_PREFIX_SIZE + size > bytes.byteLength
      )
        return new Error("invalid attachment metadata size")
      const header = headerSchema.safeParse(
        JSON.parse(
          new TextDecoder("utf-8", { fatal: true }).decode(
            bytes.subarray(ATTACHMENT_RECORD_PREFIX_SIZE, ATTACHMENT_RECORD_PREFIX_SIZE + size),
          ),
        ),
      )
      if (!header.success) return header.error
      return this.create(
        header.data.attachment,
        bytes.subarray(ATTACHMENT_RECORD_PREFIX_SIZE + size),
      )
    } catch (cause) {
      return new Error("attachment record cannot be restored", { cause })
    }
  }
}
