import type { SystemD1Context } from "@system/configuration/system-context"
import { proposalDigestSchema } from "@system/domain/schemas/workflow/system-case-reference.schema"
import { z } from "zod"

type Context = SystemD1Context
const dateSchema = z
  .number()
  .int()
  .transform((value) => new Date(value))
const taskSchema = z
  .object({
    key: z.string().min(1).max(100),
    round: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    proposalDigest: proposalDigestSchema,
    requiredApprovals: z.number().int().min(1).max(100),
    requiredParticipants: z.number().int().min(1).max(100),
    negativeDecisionRule: z.enum(["any-reject", "approval-impossible"]),
    delegationPolicy: z.enum(["allowed", "forbidden"]),
    returnPolicy: z.enum(["allowed", "forbidden"]),
    openedAt: dateSchema,
    dueAt: dateSchema.nullable(),
    outcome: z.enum(["approved", "rejected", "returned", "cancelled"]),
    closedAt: dateSchema,
  })
  .strict()
const snapshotSql = `SELECT json_group_array(json_object(
  'key',task_key,'round',round,'proposalDigest',proposal_digest,
  'requiredApprovals',required_approvals,'requiredParticipants',required_participants,
  'negativeDecisionRule',negative_decision_rule,'delegationPolicy',delegation_policy,
  'returnPolicy',return_policy,'openedAt',opened_at,'dueAt',due_at,'outcome',outcome,'closedAt',closed_at
)) AS snapshot FROM (SELECT * FROM system_decision_tasks WHERE case_id=?1 ORDER BY opened_at,round,task_key)`

/** 確定案件の全判断回と判断条件を復元し、人数や規則だけの変更も検出する。 */
export class PreparePreservedRecordTasksAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(input: Readonly<{ caseId: string; proposalDigest: string; executedAt: string }>) {
    try {
      const snapshot = await this.c.env.DB.prepare(snapshotSql)
        .bind(input.caseId)
        .first<string>("snapshot")
      if (snapshot === null) return new Error("record task history is unavailable")
      const parsed = z.array(taskSchema).min(1).safeParse(JSON.parse(snapshot))
      if (!parsed.success) return new Error("record task history is invalid")
      for (const task of parsed.data) {
        if (
          task.proposalDigest !== input.proposalDigest ||
          task.closedAt < task.openedAt ||
          task.closedAt.getTime() > Date.parse(input.executedAt) ||
          (task.dueAt !== null && task.dueAt < task.openedAt)
        )
          return new Error("record task history does not match execution")
      }
      return Object.freeze({
        tasks: Object.freeze(parsed.data),
        guard: this.c.env.DB.prepare(`SELECT CASE WHEN EXISTS (
          SELECT 1 FROM (${snapshotSql}) current WHERE current.snapshot=?2
        ) THEN 1 ELSE json_extract('{}','record_task_history_changed') END`).bind(
          input.caseId,
          snapshot,
        ),
      })
    } catch (cause) {
      return new Error("record task history is unavailable", { cause })
    }
  }
}
