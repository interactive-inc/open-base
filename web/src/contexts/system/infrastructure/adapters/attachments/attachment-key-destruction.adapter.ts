import type { SystemD1Context } from "@system/configuration/system-context"
import { SYSTEM_AUDIT_ACTIONS } from "@system/domain/catalogs/audit/system-audit-action.catalog"
import type {
  AttachmentErasureTargets,
  AttachmentKeyDestructionPort,
} from "@system/domain/definitions/attachments/attachment-key-destruction.definition"
import type { AttachmentErasureScope } from "@system/domain/schemas/attachments/attachment-erasure-request.schema"

type Context = SystemD1Context
type TargetRow = Readonly<{ id: string; erased: number; preserved: number }>

const preservedCondition = `EXISTS (
  SELECT 1 FROM system_attachment_preservations preservation
  WHERE preservation.attachment_id = attachment.id
    AND ((preservation.kind = 'hold' AND preservation.released_at IS NULL)
      OR (preservation.kind = 'retention' AND preservation.retain_until > ?2))
)`

/**
 * D1の添付行から包んだDEKを消し、`erased` へ移す。本体とメタデータの行は残し、
 * 業務記録からの参照と監査の対象を保つ。保全中の添付はDBのtriggerも破棄を拒否する。
 */
export class AttachmentKeyDestructionAdapter implements AttachmentKeyDestructionPort<D1PreparedStatement> {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async findTargets(
    scope: AttachmentErasureScope,
    at: Date,
  ): Promise<AttachmentErasureTargets | Error> {
    if (!Number.isSafeInteger(at.getTime())) return new Error("erasure time is invalid")
    try {
      const rows = await this.c.env.DB.prepare(
        `SELECT attachment.id AS id,
                CASE WHEN attachment.wrapped_dek IS NULL THEN 1 ELSE 0 END AS erased,
                CASE WHEN ${preservedCondition} THEN 1 ELSE 0 END AS preserved
         FROM system_attachments attachment
         WHERE ${scope.kind === "attachment" ? "attachment.id = ?1" : "attachment.owner_account_id = ?1"}
         ORDER BY attachment.id
         LIMIT 1001`,
      )
        .bind(scope.kind === "attachment" ? scope.attachmentId : scope.accountId, at.getTime())
        .all<TargetRow>()
      if (rows.results.length > 1000) return new Error("too many attachments for one erasure")
      return {
        erasable: rows.results
          .filter((row) => row.erased === 0 && row.preserved === 0)
          .map((row) => row.id),
        preserved: rows.results
          .filter((row) => row.erased === 0 && row.preserved === 1)
          .map((row) => row.id),
        erased: rows.results.filter((row) => row.erased === 1).map((row) => row.id),
      }
    } catch (cause) {
      return new Error("failed to resolve attachment erasure targets", { cause })
    }
  }

  /** 対象の包んだDEKを消し、同じbatchの中で全対象が消去済みになったことを確かめる。 */
  prepareDestroy(
    input: Readonly<{ attachmentIds: ReadonlyArray<string>; erasedAt: Date }>,
  ): ReadonlyArray<D1PreparedStatement> | Error {
    if (input.attachmentIds.length === 0 || !Number.isSafeInteger(input.erasedAt.getTime()))
      return new Error("attachment key destruction input is invalid")
    const ids = JSON.stringify(input.attachmentIds)
    return [
      this.c.env.DB.prepare(
        `UPDATE system_attachments
         SET status = 'erased', wrapped_dek = NULL, wrapped_dek_iv = NULL, erased_at = ?2
         WHERE id IN (SELECT value FROM json_each(?1)) AND wrapped_dek IS NOT NULL`,
      ).bind(ids, input.erasedAt.getTime()),
      this.c.env.DB.prepare(
        `SELECT CASE WHEN
           (SELECT count(*) FROM system_attachments
            WHERE id IN (SELECT value FROM json_each(?1))
              AND status = 'erased' AND wrapped_dek IS NULL AND wrapped_dek_iv IS NULL) = json_array_length(?1)
         THEN 1 ELSE json_extract('{}', 'attachment_key_destruction_incomplete') END AS ok`,
      ).bind(ids),
    ]
  }

  /**
   * 同じ添付を含む未完了の消去案件が無いことを、案件を作るtransactionでも検査する。
   * 既に判断待ちか承認済みの申請がある添付へ、二重に申請させない。
   */
  prepareNoOpenErasure(attachmentIds: ReadonlyArray<string>): D1PreparedStatement {
    return this.c.env.DB.prepare(
      `SELECT CASE WHEN NOT EXISTS (${openErasureSql})
       THEN 1 ELSE json_extract('{}', 'attachment_erasure_duplicate') END AS ok`,
    ).bind(JSON.stringify(attachmentIds))
  }

  async hasOpenErasure(attachmentIds: ReadonlyArray<string>): Promise<boolean | Error> {
    try {
      const row = await this.c.env.DB.prepare(
        `SELECT CASE WHEN EXISTS (${openErasureSql}) THEN 1 ELSE 0 END AS found`,
      )
        .bind(JSON.stringify(attachmentIds))
        .first<number>("found")
      return row === 1
    } catch (cause) {
      return new Error("failed to inspect open attachment erasures", { cause })
    }
  }

  /** 実行済みの消去案件について、破棄を記録した監査が残っているかを確かめる。 */
  async findDestructionAudit(requestId: string): Promise<string | null | Error> {
    try {
      return await this.c.env.DB.prepare(
        `SELECT event_id FROM system_audit_events
         WHERE action = ?2
           AND target_type = 'system:attachment-erasure' AND target_id = ?1
           AND outcome = 'succeeded'
         LIMIT 1`,
      )
        .bind(requestId, SYSTEM_AUDIT_ACTIONS.systemAttachmentKeyDestroyed)
        .first<string>("event_id")
    } catch (cause) {
      return new Error("failed to find attachment key destruction audit", { cause })
    }
  }
}

const openErasureSql = `SELECT 1
  FROM system_proposals proposal
  JOIN system_proposal_cases association ON association.proposal_id = proposal.id
  JOIN system_cases workflow_case ON workflow_case.id = association.case_id
  JOIN json_each(json_extract(proposal.body_json, '$.targetAttachmentIds')) target
  WHERE workflow_case.status IN ('pending', 'approved')
    AND json_extract(proposal.body_json, '$.operation') = 'system.attachment.erase'
    AND target.value IN (SELECT value FROM json_each(?1))`
