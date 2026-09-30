import type { CompanyResource } from "@/lib/api/types/company-resource-types"
import { readResourceNumber } from "@/lib/company/read-resource-number"
import { readResourceText } from "@/lib/company/read-resource-text"

/**
 * 権限範囲（AuthorityScope）の中身を 1 行に畳む。
 * scopeType ごとに持つ属性が違う（識別子・地域コード・金額の範囲）ため、
 * 種別で分岐して読み分ける。
 */
export function toAuthorityScopeLabel(resource: CompanyResource): string {
  const scopeType = readResourceText(resource, "scopeType")

  if (scopeType === "region") {
    return readResourceText(resource, "regionCode") ?? "-"
  }

  if (scopeType === "amount") {
    const currencyCode = readResourceText(resource, "currencyCode") ?? ""

    const minimumAmount = readResourceNumber(resource, "minimumAmount")

    const maximumAmount = readResourceNumber(resource, "maximumAmount")

    const lower = minimumAmount === null ? "" : `${minimumAmount.toLocaleString("en-US")} 以上`

    const upper = maximumAmount === null ? "" : `${maximumAmount.toLocaleString("en-US")} 以下`

    if (lower === "" && upper === "") return currencyCode === "" ? "-" : currencyCode

    return `${currencyCode} ${[lower, upper].filter((part) => part !== "").join(" ")}`.trim()
  }

  return readResourceText(resource, "scopeId") ?? "-"
}
