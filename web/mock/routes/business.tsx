import Customers from "@/pages/customers/index"
import CustomerDetail from "@/pages/customers/[id]"
import Offerings from "@/pages/offerings/index"
import Projects from "@/pages/projects/index"
import ProjectDetail from "@/pages/projects/[id]"
import Work from "@/pages/work/index"
import WorkRun from "@/pages/work/runs/[id]"
import type { MockRoute } from "./route"

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** 業務の領域（顧客、サービス、案件、業務の実行）の画面。 */
export const route: MockRoute = ({ path, query, email }) => {
  const parts = path.split("/").filter(Boolean)
  const [area, second, third] = parts
  if (area === "customers") {
    if (parts.length === 1) return <Customers email={email} pathname="/customers" />
    if (parts.length === 2)
      return <CustomerDetail email={email} pathname="/customers" id={second ?? ""} />
  }
  if (area === "offerings" && parts.length === 1)
    return <Offerings email={email} pathname="/offerings" />
  if (area === "projects") {
    if (parts.length === 1) return <Projects email={email} pathname="/projects" />
    if (parts.length === 2)
      return <ProjectDetail email={email} pathname="/projects" id={second ?? ""} />
  }
  if (area === "work") {
    if (parts.length === 1) return <Work email={email} pathname="/work" />
    if (second === "runs" && parts.length === 3) {
      const slug = query.get("slug") ?? ""
      return (
        <WorkRun
          email={email}
          pathname="/work"
          id={third ?? ""}
          slug={SLUG.test(slug) ? slug : null}
        />
      )
    }
  }
  return null
}
