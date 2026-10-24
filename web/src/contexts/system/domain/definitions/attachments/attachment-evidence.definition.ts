import { z } from "zod"

/** 判断対象に固定する添付の識別情報。暗号鍵と保存先は含めない。 */
export const attachmentEvidenceSchema = z
  .object({
    id: z.string().min(1).max(64),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    fileName: z.string().min(1).max(255),
    contentType: z.string().min(1).max(255),
    byteSize: z.number().int().positive().safe(),
  })
  .strict()

export type AttachmentEvidence = z.infer<typeof attachmentEvidenceSchema>
