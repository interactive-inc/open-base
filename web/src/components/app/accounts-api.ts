import type { LoadedApiJson } from "@/components/app/use-api-json"
import type { AccountEmployeeLinkList } from "@/components/app/accounts-types"

/** Accountと従業員の結び付けを読む。会社の識別子をヘッダーで渡す必要があるため、専用に読む。 */
export async function fetchAccountEmployeeLinks(
  organizationId: string,
  signal?: AbortSignal,
): Promise<LoadedApiJson<AccountEmployeeLinkList>> {
  try {
    const response = await fetch("/api/company/account-employee-links", {
      credentials: "same-origin",
      headers: { "x-company-organization-id": organizationId },
      signal,
    })
    if (response.status === 401 || response.status === 403 || response.status === 404) {
      return { kind: "forbidden" }
    }
    if (!response.ok) return { kind: "error" }
    return { kind: "ok", data: (await response.json()) as AccountEmployeeLinkList }
  } catch {
    return { kind: "error" }
  }
}

/** 会社の暦の今日（YYYY-MM-DD）。日付の表示と同じ時間帯で数える。 */
export function companyToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(now)
}
