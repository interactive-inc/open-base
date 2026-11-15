/** 従業員の名簿の検索条件。画面のURLと名簿のAPIの間で使う。 */
export type DirectoryFilters = {
  q: string
  department: string
  status: "" | "active" | "leave" | "retired"
  offset: number
}

export const PAGE_SIZE = 50

export const NO_FILTERS: DirectoryFilters = { q: "", department: "", status: "", offset: 0 }

/** 検索の条件から、名簿のAPIの経路を作る。画面とloaderで同じものを使う。 */
export function directoryPath(filters: DirectoryFilters): string {
  const query = new URLSearchParams()
  if (filters.q !== "") query.set("q", filters.q)
  if (filters.department !== "") query.set("organization_unit", filters.department)
  if (filters.status !== "") query.set("status", filters.status)
  query.set("limit", String(PAGE_SIZE))
  query.set("offset", String(filters.offset))
  return `/company/employee-directory?${query.toString()}`
}

/** 検索の条件を、画面のURLのクエリにする。既定の値は書かない。 */
export function filtersToSearch(filters: DirectoryFilters): string {
  const query = new URLSearchParams()
  if (filters.q !== "") query.set("q", filters.q)
  if (filters.department !== "") query.set("department", filters.department)
  if (filters.status !== "") query.set("status", filters.status)
  if (filters.offset > 0) query.set("offset", String(filters.offset))
  const text = query.toString()
  return text === "" ? "" : `?${text}`
}

/** URLの条件を読む。APIが受け付けない値は無かったことにする。 */
export function readFilters(read: (name: string) => string | null | undefined): DirectoryFilters {
  const q = (read("q") ?? "").trim().slice(0, 200)
  const department = (read("department") ?? "").trim().slice(0, 200)
  const status = read("status")
  const offset = Number(read("offset") ?? "0")
  return {
    q,
    department,
    status: status === "active" || status === "leave" || status === "retired" ? status : "",
    offset:
      Number.isInteger(offset) && offset >= 0 && offset <= 10_000
        ? offset - (offset % PAGE_SIZE)
        : 0,
  }
}
