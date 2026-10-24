import { cleanup, render, screen, within } from "@testing-library/react"
import { afterEach, describe, expect, test, vi } from "vite-plus/test"
import { SidebarNav } from "@/components/sidebar-nav"
import { SidebarProvider } from "@/components/ui/sidebar"
import { featureRegistry } from "@/lib/feature/feature-registry"

const pathnameMock = vi.fn<() => string>(() => "/")

vi.mock("next/navigation", () => ({
  usePathname: () => pathnameMock(),
  useRouter: () => ({ push: vi.fn() }),
}))
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }))
vi.mock("next/link", () => ({
  default: ({
    children,
    prefetch,
    ...props
  }: React.ComponentProps<"a"> & { prefetch?: boolean }) => (
    <a data-prefetch={prefetch === undefined ? "undefined" : String(prefetch)} {...props}>
      {children}
    </a>
  ),
}))

const inboxCounts = { applications: 0, expenses: 0, leaves: 0, shifts: 0, thanks: 0 }

/** admin 相当。registry が要求する permission をすべて持つ。 */
const allPermissions = featureRegistry.flatMap((feature) =>
  feature.routes.flatMap((route) => {
    if (route.visibility.kind === "permission") return [route.visibility.permission]

    if (route.visibility.kind === "everyone") return []

    return route.visibility.permissions
  }),
)

afterEach(() => {
  cleanup()

  pathnameMock.mockReturnValue("/")
})

describe("SidebarNav audit entry", () => {
  test("shows a no-prefetch audit link only with live audit:read permission", () => {
    pathnameMock.mockReturnValue("/system/batches")

    renderSidebar(["audit:read"])

    const link = screen.getByRole("link", { name: "監査ログ" })
    expect(link.getAttribute("href")).toBe("/system/audit-events")
    expect(link.getAttribute("data-prefetch")).toBe("false")
  })

  test("hides the audit entry without read permission", () => {
    pathnameMock.mockReturnValue("/system/batches")

    renderSidebar(["audit:export", "batch:view"])

    expect(screen.queryByRole("link", { name: "監査ログ" })).toBeNull()
  })

  test("does not change the existing prefetch behavior of unrelated links", () => {
    pathnameMock.mockReturnValue("/system/batches")

    renderSidebar(["batch:view"])

    expect(screen.getByRole("link", { name: "バッチ" }).getAttribute("data-prefetch")).toBe(
      "undefined",
    )
  })
})

function renderSidebar(
  permissions: ReadonlyArray<string>,
  disabledFeatures: ReadonlyArray<string> = [],
) {
  return render(
    <SidebarProvider>
      <SidebarNav
        inboxCounts={inboxCounts}
        unreadNotificationCount={0}
        permissions={permissions}
        disabledFeatures={disabledFeatures}
        myDepartments={[{ code: "D001", name: "Corporate Planning", assignment_type: "primary" }]}
        allDepartments={[
          { code: "D001", name: "Corporate Planning", depth: 0 },
          { code: "D003", name: "Engineering", depth: 1 },
        ]}
      />
    </SidebarProvider>,
  )
}

describe("Foundation navigation", () => {
  test("exposes only System and Company capabilities", () => {
    renderSidebar(allPermissions)
    expect(screen.queryByRole("tab", { name: "業務" })).toBeNull()
    expect(screen.getByRole("tab", { name: "会社" })).toBeTruthy()
    expect(screen.getByRole("tab", { name: "システム" })).toBeTruthy()
    expect(
      featureRegistry.every((feature) => feature.tier === "system" || feature.tier === "company"),
    ).toBe(true)
  })
  test("shows employee navigation in company space", () => {
    pathnameMock.mockReturnValue("/company/employees")
    renderSidebar(["employee:read"])
    expect(screen.getByRole("link", { name: "従業員" }).getAttribute("href")).toBe(
      "/company/employees",
    )
  })
  test("shows department members for the selected department", () => {
    pathnameMock.mockReturnValue("/teams/D001/members")
    renderSidebar(["employee:read"])
    expect(screen.getByRole("link", { name: "メンバー" }).getAttribute("href")).toBe(
      "/teams/D001/members",
    )
    expect(screen.queryByRole("link", { name: "勤怠" })).toBeNull()
  })
})
