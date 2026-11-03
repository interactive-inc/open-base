import type { SystemDatabase, SystemRequestAudit } from "@system/configuration/system-context"

/** Company の application / infrastructure が受け取る製品非依存の最小実行依存。 */
export type CompanyContext = Readonly<{
  var: Readonly<{
    database: SystemDatabase
    auditContext: SystemRequestAudit
    /** 直接発令と同じ保存境界で、入口の操作者の認可を再照合する。 */
    directPersonnelActionAssertions?: ReadonlyArray<D1PreparedStatement>
  }>
  env: Readonly<{
    DB: D1Database
    COMPANY_TIME_ZONE?: string
    NOW?: string
  }>
}>
