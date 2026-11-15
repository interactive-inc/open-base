import { readAuditQuery } from "@/components/app/operations-audit"
import OperationsOverview from "@/pages/operations/index"
import AuditEvents from "@/pages/operations/audit/index"
import AuditEventDetail from "@/pages/operations/audit/[id]"
import AuditDisclosure from "@/pages/operations/audit/disclosure"
import WorkItems from "@/pages/operations/work-items/index"
import WorkItemPage from "@/pages/operations/work-items/[id]"
import Deliveries from "@/pages/operations/deliveries/index"
import Connectors from "@/pages/operations/connectors/index"
import ConnectorPage from "@/pages/operations/connectors/[id]"
import type { MockRoute } from "./route"

/** 運用と監査の画面の割り当て。`/operations` の外はnullを返す。 */
export const route: MockRoute = ({ path, query, email }) => {
  if (path !== "/operations" && !path.startsWith("/operations/")) return null
  const common = { email, pathname: "/operations" } as const
  const segments = path.split("/").filter(Boolean)
  const [, section, id] = segments

  if (section === undefined) return <OperationsOverview {...common} />
  if (section === "audit") {
    if (id === undefined) {
      const { ledger, filters } = readAuditQuery(query)
      return <AuditEvents {...common} ledger={ledger} filters={filters} />
    }
    if (id === "disclosure")
      return <AuditDisclosure {...common} scope={query.get("scope") ?? "*"} />
    return (
      <AuditEventDetail
        {...common}
        id={id}
        ledger={query.get("ledger") === "system" ? "system" : "company"}
      />
    )
  }
  if (section === "work-items") {
    if (id === undefined) return <WorkItems {...common} />
    return <WorkItemPage {...common} id={id} />
  }
  if (section === "deliveries") return <Deliveries {...common} />
  if (section === "connectors") {
    if (id === undefined) return <Connectors {...common} />
    return <ConnectorPage {...common} id={id} />
  }
  return <OperationsOverview {...common} />
}
