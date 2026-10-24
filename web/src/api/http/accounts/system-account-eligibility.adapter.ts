import type {
  CompanyAccountEligibility as AccountEligibilityPort,
  CompanyAccountEligibilityResult as AccountEligibilityPortResult,
} from "@/contexts/company/interface/operations/resolve-company-account-employee-link"
import type { SystemAccountId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { readSystemAccountSnapshot } from "@system/interface/operations/read-system-account-snapshot"

/** API 合成層で System Account の利用可否を Company の抽象境界へ接続する。 */
export class SystemAccountEligibilityAdapter implements AccountEligibilityPort {
  constructor(private readonly database: D1Database) {
    Object.freeze(this)
  }

  async evaluate(accountId: SystemAccountId): Promise<AccountEligibilityPortResult> {
    const parsed = zAccountId.safeParse(accountId)
    if (!parsed.success) return { ok: true, eligible: false }

    const account = await readSystemAccountSnapshot(this.database, parsed.data)
    if (account instanceof Error) return { ok: false, cause: account }
    return { ok: true, eligible: account?.status === "active" }
  }
}
