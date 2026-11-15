import type { ReactNode } from "react"
import { createRoot } from "react-dom/client"
import "@/client/page-setup"
import { StandaloneAppShell } from "@/components/app/app-shell"
import Home from "@/pages/index"
import Applications from "@/pages/applications/index"
import ApplicationDetail from "@/pages/applications/[id]"
import SignIn from "@/pages/sign-in"
import Enroll from "@/pages/enroll"
import Device from "@/pages/device"
import { routes } from "./routes"

const query = new URLSearchParams(location.search)
const path = location.pathname
const email = "you@example.com"
const publicPage = path === "/sign-in" || path === "/enroll" || path === "/device"
/** サイドバーを出さない画面。サインイン前後の手続きと、CLIから開く判断の画面。 */
const bare = publicPage || path.startsWith("/decisions/")

/** 領域ごとの割り当てを先に試し、どれでもなければ土台の画面を出す。 */
function resolve(): ReactNode {
  for (const route of routes) {
    const page = route({ path, query, email })
    if (page !== null) return page
  }
  if (path === "/sign-in") return <SignIn next="/" method="password" error={null} />
  if (path === "/enroll") return <Enroll token={query.get("token")} />
  if (path === "/device")
    return (
      <Device userCode={query.get("user_code") ?? "DEMO-CODE"} method="password" freshlySignedIn />
    )
  if (path === "/applications") return <Applications email={email} pathname="/applications" />
  if (path.startsWith("/applications/"))
    return (
      <ApplicationDetail email={email} pathname="/applications" id={path.split("/")[2] ?? ""} />
    )
  return <Home email={email} pathname="/" />
}

const session: unknown = await fetch("/api/auth/get-session").then((response) => response.json())
const signedIn =
  session !== null && typeof session === "object" && "user" in session && Boolean(session.user)
if (!publicPage && !signedIn) location.replace("/sign-in")
else
  createRoot(document.getElementById("root")!).render(
    // 製品ではVoidのレイアウトが枠を描く。モックにはVoidが無いので、ここで同じ枠を付ける。
    bare ? (
      resolve()
    ) : (
      <StandaloneAppShell email={email} pathname={path}>
        {resolve()}
      </StandaloneAppShell>
    ),
  )
