import type {
  SystemD1Context,
  SystemDatabaseContext,
  SystemAttachmentStorageContext,
} from "@system/configuration/system-context"
import { AttachmentAdapter } from "@system/infrastructure/adapters/attachments/attachment.adapter"
import { VerifyAttachmentContentAdapter } from "@system/infrastructure/adapters/attachments/verify-attachment-content.adapter"
import { PrepareAttachmentContentReadGuardAdapter } from "@system/infrastructure/adapters/attachments/prepare-attachment-content-read-guard.adapter"
import { AttachmentRecordContentValue } from "@system/domain/values/records/attachment-record-content.value"
import { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"
import { PreservedRecordContentValue } from "@system/domain/values/records/preserved-record-content.value"
import { ATTACHMENT_RECORD_FORMAT_ID } from "@system/domain/catalogs/records/attachment-record-format.catalog"
import { z } from "zod"

type Context = SystemD1Context &
  SystemDatabaseContext &
  SystemAttachmentStorageContext &
  Readonly<{
    now: () => Date
    assertions: ReadonlyArray<D1PreparedStatement>
  }>

/** 所有業務の参照資格・関連行の検査を受け取り、添付メタデータと本体を保全候補へ固定する。 */
export class CaptureLinkedAttachmentRecordAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(input: unknown) {
    const parsed = z
      .strictObject({
        attachmentId: z.string().min(1).max(64),
        sourceNamespace: z.string().regex(/^\S{1,255}$/),
        ownerContext: z.string().regex(/^[a-z][a-z0-9-]{0,99}$/),
        recordKind: z.string().regex(/^[a-z][a-z0-9_.:-]{0,199}$/),
      })
      .safeParse(input)
    if (!parsed.success) return parsed.error
    if (this.c.assertions.length === 0) return new Error("attachment source authorization required")
    try {
      const initial = await this.c.env.DB.batch([...this.c.assertions])
      if (initial.length !== this.c.assertions.length || initial.some((result) => !result.success))
        return new Error("attachment source authorization unavailable")
      const row = await new AttachmentAdapter(this.c).findById(parsed.data.attachmentId)
      if (row instanceof Error) return row
      const capturedAt = this.c.now()
      if (
        row === null ||
        row.linkedAt === null ||
        row.createdAt > capturedAt ||
        row.linkedAt > capturedAt
      )
        return new Error("linked attachment source unavailable")
      const bytes = await new VerifyAttachmentContentAdapter(this.c).execute(row, "linked")
      if (bytes instanceof Error) return bytes
      const attachment = await AttachmentRecordContentValue.create(
        {
          id: row.id,
          sha256: row.plaintextSha256,
          fileName: row.fileName,
          contentType: row.contentType,
          byteSize: row.byteSize,
          ownerAccountId: row.ownerAccountId,
          createdAt: row.createdAt.toISOString(),
          linkedAt: row.linkedAt.toISOString(),
        },
        bytes,
      )
      if (attachment instanceof Error) return attachment
      const encoded = attachment.toBytes()
      if (encoded instanceof Error) return encoded
      const contentDigest = [...new Uint8Array(await crypto.subtle.digest("SHA-256", encoded))]
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("")
      const source = PreservedRecordSourceValue.create({
        sourceNamespace: parsed.data.sourceNamespace,
        ownerContext: parsed.data.ownerContext,
        recordKind: parsed.data.recordKind,
        recordId: row.id,
        formatId: ATTACHMENT_RECORD_FORMAT_ID,
        formatVersion: 1,
        sourceRevision: null,
        sourceRecordedAt: null,
        capturedAt: capturedAt.toISOString(),
        contentDigest,
      })
      if (source instanceof Error) return source
      const content = await PreservedRecordContentValue.create(source, encoded)
      if (content instanceof Error) return content
      const assertions = [
        ...this.c.assertions,
        new PrepareAttachmentContentReadGuardAdapter(this.c).prepare(row, capturedAt),
      ]
      const verified = await this.c.env.DB.batch(assertions)
      if (verified.length !== assertions.length || verified.some((result) => !result.success))
        return new Error("attachment source changed")
      return Object.freeze({ source, content, assertions: Object.freeze(assertions) })
    } catch (cause) {
      return new Error("attachment source capture failed", { cause })
    }
  }
}
