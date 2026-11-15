import OrganizationChart from "@/pages/organization/index"
import CompanyProfilePage from "@/pages/organization/company"
import Grades from "@/pages/organization/grades/index"
import GradeAssignments from "@/pages/organization/grades/assignments"
import Reporting from "@/pages/organization/reporting"
import OrganizationUnitPage from "@/pages/organization/units/[code]"
import type { MockRoute } from "./route"

/** モックの会社の組織ID。モックはヘッダーの値を見ないが、本物と同じ形で渡す。 */
const ORGANIZATION_ID = "example-organization"

export const route: MockRoute = ({ path, query, email }) => {
  const common = { email, pathname: "/organization", organizationId: ORGANIZATION_ID }
  if (path === "/organization") return <OrganizationChart {...common} />
  if (path === "/organization/company") return <CompanyProfilePage {...common} />
  if (path === "/organization/grades") return <Grades {...common} />
  if (path === "/organization/grades/assignments")
    return <GradeAssignments {...common} employeeCode={query.get("employee")} />
  if (path === "/organization/reporting")
    return <Reporting {...common} employeeCode={query.get("employee")} />
  if (path.startsWith("/organization/units/"))
    return (
      <OrganizationUnitPage
        {...common}
        code={decodeURIComponent(path.slice("/organization/units/".length))}
      />
    )
  return null
}
