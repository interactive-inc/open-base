import type { CompanyPersonnelActionQuery } from "@/lib/api/get-company-personnel-actions"

export function personnelActionHistoryHref(query: CompanyPersonnelActionQuery): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") params.set(key, String(value))
  }
  const suffix = params.toString()
  return `/company/personnel-actions${suffix === "" ? "" : `?${suffix}`}`
}
