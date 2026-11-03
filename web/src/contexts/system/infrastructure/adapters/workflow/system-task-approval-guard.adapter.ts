import type { SystemD1Context } from "@system/configuration/system-context"

export type SystemTaskApprovalTarget = Readonly<{ caseId: string; taskKey: string; round: number }>
type Context = SystemD1Context & Readonly<{ approvalTask?: SystemTaskApprovalTarget }>

/** 保存した票の集計で承認された段階だけ、同じ一括書き込みで検査する。 */
export class SystemTaskApprovalGuardAdapter {
  constructor(private readonly c: Context) {}

  prepare(
    sql: string,
    parameters: ReadonlyArray<string | number | null> = [],
  ): D1PreparedStatement {
    const target = this.c.approvalTask
    if (target === undefined) return this.c.env.DB.prepare(sql).bind(...parameters)
    const offset = parameters.length
    return this.c.env.DB.prepare(`SELECT CASE WHEN EXISTS (
      SELECT 1 FROM system_decision_tasks
      WHERE case_id=?${offset + 1} AND task_key=?${offset + 2} AND round=?${offset + 3}
        AND outcome='approved'
    ) THEN (${sql}) ELSE 1 END`).bind(...parameters, target.caseId, target.taskKey, target.round)
  }
}
