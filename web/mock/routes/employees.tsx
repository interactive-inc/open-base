import Employees from "@/pages/employees/index"
import EmployeeDetail from "@/pages/employees/[code]"
import PersonnelActions from "@/pages/employees/actions/index"
import MyProfile from "@/pages/profile/index"
import { readFilters } from "@/components/app/employees-directory-query"
import type { MockRoute } from "./route"

/** 従業員と本人の情報の画面。loaderの代わりに、URLの値を同じ規則で読む。 */
export const route: MockRoute = ({ path, query, email }) => {
  if (path === "/profile") return <MyProfile email={email} pathname="/profile" />
  if (path === "/employees")
    return (
      <Employees
        email={email}
        pathname="/employees"
        filters={readFilters((name) => query.get(name))}
      />
    )
  if (path === "/employees/actions") return <PersonnelActions email={email} pathname="/employees" />
  const match = /^\/employees\/([^/]+)$/.exec(path)
  if (match === null) return null
  let code: string
  try {
    code = decodeURIComponent(match[1] ?? "")
  } catch {
    code = ""
  }
  const asOf = query.get("as_of")
  return (
    <EmployeeDetail
      email={email}
      pathname="/employees"
      code={code}
      asOf={asOf !== null && /^\d{4}-\d{2}-\d{2}$/.test(asOf) ? asOf : null}
    />
  )
}
