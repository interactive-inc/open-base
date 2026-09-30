import { accountEmployeeLinks } from "@/contexts/company/infrastructure/schema/employee"
import { companyAccountProfiles } from "@/contexts/company/infrastructure/schema/company"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { and, eq, inArray } from "drizzle-orm"
import type { DrizzleD1Database } from "drizzle-orm/d1"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

/** Companyの既定organization。 */
const DEFAULT_ORGANIZATION_ID = COMPANY_DEFAULT_ORGANIZATION_ID

type Props = Readonly<{
  employeeId: EmployeeId
  officialName: string
  now: Date
}>

type AlignAccountDisplayNameToEmployeeAdapterContext = Pick<DrizzleD1Database, "select" | "update">
type Context = AlignAccountDisplayNameToEmployeeAdapterContext

/**
 * 従業員氏名を書く batch へ載せる、紐付きアカウントの表示名を同じ値へ揃えるステートメント。
 *
 * 従業員に紐付いたアカウントは従業員氏名を正本にするので、氏名を書く経路は必ずこの文を同じ
 * batch へ含める。別 batch にすると「従業員だけ変わって表示名が旧姓のまま」の中間状態が残る。
 *
 * 紐付けが無いアカウントには 0 行しか当たらないので、呼び出し側で紐付きを事前に確かめなくてよい。
 * 紐付け作成と同じ batch へ載せる場合は、この文を link の INSERT より後ろへ置く。D1 batch は
 * 1 トランザクション内で順に実行されるため、後ろに置けば副問い合わせが新しい link を読む。
 *
 * この文は表示名を書くだけで、値の妥当性は検証しない。official_name が表示名の規則
 * （前後空白なし・1〜200 文字・NUL 不可）を満たすことは書き込み境界が保証する。
 */
export class AlignAccountDisplayNameToEmployeeAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  /**
   * 従業員氏名をそのまま表示名へ写す。ここで trim や切り詰めをしない。
   *
   * 不変条件は「official_name と display_name の完全一致」であり、JS の `String.trim` は NBSP など
   * Unicode 空白まで落とすのに対し SQLite の `trim()` は ASCII 空白しか落とさないので、
   * ここで正規化を挟むと DB の CHECK を通る値どうしでズレを作れてしまう。正規化は書き込み境界
   * （職員詳細 PUT・従業員名簿 PUT・アカウント発行）の zod / NameValue が済ませている前提とする。
   */
  buildAlignment(props: Props) {
    return this.c
      .update(companyAccountProfiles)
      .set({ displayName: props.officialName, updatedAt: props.now.getTime() })
      .where(
        and(
          eq(companyAccountProfiles.organizationId, DEFAULT_ORGANIZATION_ID),
          inArray(
            companyAccountProfiles.accountId,
            this.c
              .select({ accountId: accountEmployeeLinks.accountId })
              .from(accountEmployeeLinks)
              .where(eq(accountEmployeeLinks.employeeId, props.employeeId)),
          ),
        ),
      )
  }
}
