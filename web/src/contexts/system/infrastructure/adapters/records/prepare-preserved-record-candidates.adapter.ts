import type { SystemD1Context } from "@system/configuration/system-context"
import { DecisionTaskCandidateEntity } from "@system/domain/entities/decision-task-candidate.entity"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { z } from "zod"

type Context = SystemD1Context
const taskSchema = z.object({
  taskKey: z.string().min(1).max(100),
  round: z.number().int().positive(),
})
const snapshotSchema = z
  .object({
    candidates: z.array(
      taskSchema
        .extend({
          candidate: z
            .object({ eligibleFrom: z.number().int().nullable(), resolvedAt: z.number().int() })
            .passthrough(),
        })
        .strict(),
    ),
    exclusions: z.array(
      taskSchema
        .extend({ accountId: zAccountId, reason: z.enum(["creator", "subject", "policy"]) })
        .strict(),
    ),
  })
  .strict()
const snapshotSql = `SELECT json_object(
  'candidates', (SELECT json_group_array(json_object(
    'taskKey',task_key,'round',round,'candidate',json_object(
      'accountId',candidate_account_id,'source',source,'evidenceContext',evidence_context,
      'evidenceKind',evidence_kind,'evidenceId',evidence_id,'evidenceVersion',evidence_version,
      'eligibilityDigest',eligibility_digest,'eligibleFrom',eligible_from,'resolvedAt',resolved_at)))
    FROM (SELECT * FROM system_decision_task_candidates WHERE case_id=?1 ORDER BY task_key,round,candidate_account_id,source)),
  'exclusions', (SELECT json_group_array(json_object(
    'taskKey',task_key,'round',round,'accountId',excluded_account_id,'reason',reason))
    FROM (SELECT * FROM system_decision_task_exclusions WHERE case_id=?1 ORDER BY task_key,round,excluded_account_id))
) AS snapshot`

/** 全判断回の候補資格と除外理由を、資格所有元の意味を解釈せず復元する。 */
export class PreparePreservedRecordCandidatesAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(caseId: string) {
    try {
      const snapshot = await this.c.env.DB.prepare(snapshotSql)
        .bind(caseId)
        .first<string>("snapshot")
      if (snapshot === null) return new Error("record candidate evidence is unavailable")
      const parsed = snapshotSchema.safeParse(JSON.parse(snapshot))
      if (!parsed.success) return new Error("record candidate evidence is invalid")
      const candidates: Array<
        Readonly<{ taskKey: string; round: number; candidate: DecisionTaskCandidateEntity }>
      > = []
      for (const row of parsed.data.candidates) {
        const candidate = DecisionTaskCandidateEntity.create({
          ...row.candidate,
          eligibleFrom:
            row.candidate.eligibleFrom === null ? null : new Date(row.candidate.eligibleFrom),
          resolvedAt: new Date(row.candidate.resolvedAt),
        })
        if (candidate instanceof Error) return candidate
        candidates.push({ taskKey: row.taskKey, round: row.round, candidate })
      }
      return Object.freeze({
        candidates: Object.freeze(
          candidates.map((row) => ({
            taskKey: row.taskKey,
            round: row.round,
            accountId: row.candidate.accountId,
            source: row.candidate.source,
            evidenceContext: row.candidate.evidenceContext,
            evidenceKind: row.candidate.evidenceKind,
            evidenceId: row.candidate.evidenceId,
            evidenceVersion: row.candidate.evidenceVersion,
            eligibilityDigest: row.candidate.eligibilityDigest,
            eligibleFrom: row.candidate.eligibleFrom,
            resolvedAt: row.candidate.resolvedAt,
          })),
        ),
        exclusions: Object.freeze(parsed.data.exclusions),
        guard: this.c.env.DB.prepare(`SELECT CASE WHEN EXISTS (
          SELECT 1 FROM (${snapshotSql}) current WHERE current.snapshot=?2
        ) THEN 1 ELSE json_extract('{}','record_candidate_evidence_changed') END`).bind(
          caseId,
          snapshot,
        ),
      })
    } catch (cause) {
      return new Error("record candidate evidence is unavailable", { cause })
    }
  }
}
