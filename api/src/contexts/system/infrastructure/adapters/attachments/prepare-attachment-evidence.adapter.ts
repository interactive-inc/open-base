import type { SystemD1Context } from "@system/configuration/system-context"
import {
  attachmentEvidenceSchema,
  type AttachmentEvidence,
} from "@system/domain/definitions/attachments/attachment-evidence.definition"
import { SystemAttachmentError } from "@system/domain/errors"
import { abortWhenPreviousStatementChangedNoRows } from "@/lib/database/abort-when-previous-statement-changed-no-rows"
import { z } from "zod"

type Context = SystemD1Context
type Input = Readonly<{
  attachmentIds: ReadonlyArray<string>
  ownerAccountId: string
  linkedAttachmentIds: ReadonlySet<string>
  expected?: ReadonlyArray<AttachmentEvidence>
  at: Date
}>
const rowSchema = attachmentEvidenceSchema.extend({
  ownerAccountId: z.string(),
  objectKey: z.string(),
  status: z.enum(["pending", "linked"]),
  wrappedDek: z.string(),
  wrappedDekIv: z.string(),
  contentIv: z.string(),
  kekVersion: z.number().int().positive(),
  createdAt: z.number().int(),
  linkedAt: z.number().int().nullable(),
})

/** 添付の所有者・内容・状態を固定し、業務と同時に紐付けるstatementを用意する。 */
export class PrepareAttachmentEvidenceAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(input: Input): Promise<
    | Readonly<{
        evidence: ReadonlyArray<AttachmentEvidence>
        guards: ReadonlyArray<D1PreparedStatement>
        effects: ReadonlyArray<D1PreparedStatement>
      }>
    | SystemAttachmentError
  > {
    const ids = z.array(z.string().min(1).max(64)).max(10).safeParse(input.attachmentIds)
    if (
      !ids.success ||
      new Set(ids.data).size !== ids.data.length ||
      !Number.isSafeInteger(input.at.getTime())
    )
      return new SystemAttachmentError(
        "validation",
        "attachment_selection_invalid",
        "添付の指定が不正です",
      )
    const evidence: AttachmentEvidence[] = []
    const guards: D1PreparedStatement[] = []
    const effects: D1PreparedStatement[] = []
    try {
      for (const id of [...ids.data].sort()) {
        const stored = await this.c.env.DB.prepare(`SELECT id, owner_account_id AS ownerAccountId,
          object_key AS objectKey, status, plaintext_sha256 AS sha256, file_name AS fileName,
          content_type AS contentType, byte_size AS byteSize, wrapped_dek AS wrappedDek,
          wrapped_dek_iv AS wrappedDekIv, content_iv AS contentIv, kek_version AS kekVersion,
          created_at AS createdAt, linked_at AS linkedAt FROM system_attachments WHERE id = ?1`)
          .bind(id)
          .first()
        if (stored === null)
          return new SystemAttachmentError(
            "not_found",
            "attachment_not_found",
            "添付が見つかりません",
          )
        const row = rowSchema.safeParse(stored)
        if (!row.success)
          return new SystemAttachmentError(
            "validation",
            "attachment_unavailable",
            "添付を確認できません",
          )
        const attachment = row.data
        const status = input.linkedAttachmentIds.has(id) ? "linked" : "pending"
        if (attachment.ownerAccountId !== input.ownerAccountId)
          return new SystemAttachmentError(
            "validation",
            "attachment_not_owned",
            "他人の添付は紐付けできません",
          )
        if (
          attachment.status !== status ||
          attachment.createdAt > input.at.getTime() ||
          (attachment.linkedAt !== null && attachment.linkedAt > input.at.getTime())
        )
          return new SystemAttachmentError(
            "validation",
            "attachment_changed",
            "添付の状態を確認できません",
          )
        const snapshot = attachmentEvidenceSchema.parse({
          id,
          sha256: attachment.sha256,
          fileName: attachment.fileName,
          contentType: attachment.contentType,
          byteSize: attachment.byteSize,
        })
        evidence.push(snapshot)
        guards.push(
          this.c.env.DB.prepare(`SELECT CASE WHEN EXISTS (
          SELECT 1 FROM system_attachments WHERE id = ?1 AND owner_account_id = ?2 AND status = ?3
            AND plaintext_sha256 = ?4 AND file_name = ?5 AND content_type = ?6 AND byte_size = ?7
            AND object_key = ?8 AND wrapped_dek = ?9 AND wrapped_dek_iv = ?10 AND content_iv = ?11
            AND kek_version = ?12 AND created_at = ?13 AND linked_at IS ?14 AND erased_at IS NULL
          ) THEN 1 ELSE abs(-9223372036854775808) END`).bind(
            id,
            attachment.ownerAccountId,
            status,
            snapshot.sha256,
            snapshot.fileName,
            snapshot.contentType,
            snapshot.byteSize,
            attachment.objectKey,
            attachment.wrappedDek,
            attachment.wrappedDekIv,
            attachment.contentIv,
            attachment.kekVersion,
            attachment.createdAt,
            attachment.linkedAt,
          ),
        )
        if (status === "pending")
          effects.push(
            this.c.env.DB.prepare(
              "UPDATE system_attachments SET status = 'linked', linked_at = ?2 WHERE id = ?1 AND status = 'pending'",
            ).bind(id, input.at.getTime()),
            abortWhenPreviousStatementChangedNoRows(this.c.env.DB),
          )
      }
      if (input.expected !== undefined) {
        const expected = z.array(attachmentEvidenceSchema).max(10).safeParse(input.expected)
        if (
          !expected.success ||
          JSON.stringify(
            [...expected.data].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
          ) !== JSON.stringify(evidence)
        )
          return new SystemAttachmentError(
            "validation",
            "attachment_evidence_changed",
            "確認した添付内容が変わっています",
          )
      }
      return { evidence, guards, effects }
    } catch (cause) {
      return new SystemAttachmentError(
        "unexpected",
        "attachment_evidence_unavailable",
        "添付の状態を取得できません",
        { cause },
      )
    }
  }
}
