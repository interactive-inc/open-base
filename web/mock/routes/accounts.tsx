import AccountDetail from "@/pages/accounts/[id]"
import Accounts from "@/pages/accounts/index"
import PrincipalDetail from "@/pages/accounts/principals/[id]"
import Principals from "@/pages/accounts/principals/index"
import RoleDetail from "@/pages/accounts/roles/[id]"
import Roles from "@/pages/accounts/roles/index"
import type { MockRoute } from "./route"

/** モックの会社の識別子。モックのAPIはこの値を見ない。 */
const ORGANIZATION_ID = "example-organization"

/** アカウントと権限の管理の画面。`/accounts` の下を受け持つ。 */
export const route: MockRoute = ({ path, email }) => {
  if (path !== "/accounts" && !path.startsWith("/accounts/")) return null
  const pathname = "/accounts"
  const [, , first, second] = path.split("/")
  if (first === undefined || first === "") return <Accounts email={email} pathname={pathname} />
  if (first === "roles") {
    if (second === undefined) return <Roles email={email} pathname={pathname} />
    return <RoleDetail email={email} pathname={pathname} id={second} />
  }
  if (first === "principals") {
    if (second === undefined) return <Principals email={email} pathname={pathname} />
    return <PrincipalDetail email={email} pathname={pathname} id={second} />
  }
  return (
    <AccountDetail email={email} pathname={pathname} id={first} organizationId={ORGANIZATION_ID} />
  )
}
