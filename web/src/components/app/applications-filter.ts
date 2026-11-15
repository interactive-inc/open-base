import type { ApplicationStatus } from "@/components/app/phase-bar"

/** 申請の一覧の絞り込み。URLのクエリと同じ値を持つ。 */
export type ApplicationFilter = {
  /** `all` は全社、`department` は部署を指定して読む。読める範囲はサーバーが決める。 */
  scope: "all" | "department"
  status: ApplicationStatus | null
  template: string | null
  department: string | null
  offset: number
}

export const APPLICATION_PAGE_SIZE = 50

const STATUSES: ReadonlyArray<ApplicationStatus> = ["pending", "approved", "rejected"]
const CODE = /^[A-Za-z0-9_-]{1,100}$/

/** URLのクエリから絞り込みを読む。読めない値は指定が無いものとして扱う。 */
export function readApplicationFilter(query: URLSearchParams): ApplicationFilter {
  const status = STATUSES.find((value) => value === query.get("status")) ?? null
  const template = query.get("template") ?? ""
  const department = query.get("department") ?? ""
  const offset = Number(query.get("offset") ?? "0")
  return {
    scope: query.get("scope") === "department" ? "department" : "all",
    status,
    template: CODE.test(template) ? template : null,
    department: CODE.test(department) ? department : null,
    offset:
      Number.isSafeInteger(offset) && offset > 0 && offset % APPLICATION_PAGE_SIZE === 0
        ? offset
        : 0,
  }
}

/** 絞り込みを、画面のURLのクエリにする。既定の値は書かない。 */
export function toFilterQuery(filter: ApplicationFilter): string {
  const query = new URLSearchParams()
  if (filter.scope === "department") query.set("scope", "department")
  if (filter.status !== null) query.set("status", filter.status)
  if (filter.template !== null) query.set("template", filter.template)
  if (filter.department !== null) query.set("department", filter.department)
  if (filter.offset > 0) query.set("offset", String(filter.offset))
  return query.toString()
}

/**
 * 絞り込みから読むAPIの経路を作る。部署で読むときに部署が無ければnullを返す。
 * 部署の一覧のAPIはテンプレートで絞れないので、部署で読むときはテンプレートを送らない。
 */
export function toApplicationListPath(filter: ApplicationFilter): string | null {
  const query = new URLSearchParams()
  if (filter.scope === "department") {
    if (filter.department === null) return null
    query.set("scope", "department")
    query.set("department_code", filter.department)
  } else if (filter.template !== null) {
    query.set("template_code", filter.template)
  }
  if (filter.status !== null) query.set("status", filter.status)
  query.set("limit", String(APPLICATION_PAGE_SIZE))
  if (filter.offset > 0) query.set("offset", String(filter.offset))
  const base =
    filter.scope === "department"
      ? "/company/application-requests"
      : "/company/application-requests/admin"
  return `${base}?${query.toString()}`
}
