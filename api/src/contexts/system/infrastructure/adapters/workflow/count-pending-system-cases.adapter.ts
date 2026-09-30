import type { SystemD1Context } from "@system/configuration/system-context"
type Context = SystemD1Context

/** 未完了System Caseの件数だけを公開し、保存形式を下位contextへ漏らさない。 */
export class CountPendingSystemCasesAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async countPendingSystemCases(): Promise<number | Error> {
    try {
      return (
        (await this.c.env.DB.prepare(
          "SELECT count(*) AS total FROM system_cases WHERE status = 'pending'",
        ).first<number>("total")) ?? 0
      )
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to count pending System Cases")
    }
  }
}
