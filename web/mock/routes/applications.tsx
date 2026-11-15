import AllApplications from "@/pages/applications/all"
import ApprovalDelegations from "@/pages/applications/delegations"
import WorkflowRepairs from "@/pages/applications/repairs"
import ApplicationTemplate from "@/pages/applications/templates/[code]"
import ApplicationTemplates from "@/pages/applications/templates/index"
import ApplicationDecision from "@/pages/decisions/applications/[id]"
import { readApplicationFilter } from "@/components/app/applications-filter"
import type { MockRoute } from "./route"

const pathname = "/applications"

/** 申請の管理と判断の画面。自分の申請と詳細は土台の割り当てに任せる。 */
export const route: MockRoute = ({ path, query, email }) => {
  if (path.startsWith("/decisions/applications/"))
    return <ApplicationDecision email={email} id={path.split("/")[3] ?? ""} />
  if (path === "/applications/templates")
    return <ApplicationTemplates email={email} pathname={pathname} />
  if (path.startsWith("/applications/templates/"))
    return (
      <ApplicationTemplate
        email={email}
        pathname={pathname}
        code={decodeURIComponent(path.split("/")[3] ?? "")}
      />
    )
  if (path === "/applications/all")
    return (
      <AllApplications email={email} pathname={pathname} filter={readApplicationFilter(query)} />
    )
  if (path === "/applications/delegations")
    return <ApprovalDelegations email={email} pathname={pathname} />
  if (path === "/applications/repairs") return <WorkflowRepairs email={email} pathname={pathname} />
  return null
}
