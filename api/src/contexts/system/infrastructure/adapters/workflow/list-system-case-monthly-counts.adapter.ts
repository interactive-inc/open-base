import type { SystemD1Context } from "@system/configuration/system-context"

export type SystemCaseMonthlyCount = Readonly<{ month: string; total: number }>
type Context = SystemD1Context

/** 指定日時以降のSystem Case作成件数をUTC月単位で返す。 */
export class ListSystemCaseMonthlyCountsAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async listSystemCaseMonthlyCounts(
    createdFrom: Date,
  ): Promise<ReadonlyArray<SystemCaseMonthlyCount> | Error> {
    if (!Number.isSafeInteger(createdFrom.getTime())) return new Error("invalid System Case range")
    try {
      const rows = await this.c.env.DB.prepare(
        `SELECT strftime('%Y-%m', created_at / 1000, 'unixepoch') AS month, count(*) AS total
       FROM system_cases
       WHERE created_at >= ?1
       GROUP BY strftime('%Y-%m', created_at / 1000, 'unixepoch')
       ORDER BY month`,
      )
        .bind(createdFrom.getTime())
        .all<SystemCaseMonthlyCount>()
      return rows.results
    } catch (caught) {
      return caught instanceof Error
        ? caught
        : new Error("failed to list System Case monthly counts")
    }
  }
}
