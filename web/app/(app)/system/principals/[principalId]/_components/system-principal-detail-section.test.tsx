import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, test, vi } from "vite-plus/test"
import type { SystemPrincipal } from "@/lib/api/types/system-operation-types"
import { SystemPrincipalDetailSection } from "@/app/(app)/system/principals/[principalId]/_components/system-principal-detail-section"

const mocks = vi.hoisted(() => ({ getSystemPrincipal: vi.fn() }))

vi.mock("@/lib/api/get-system-principal", () => ({
  getSystemPrincipal: mocks.getSystemPrincipal,
}))
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const connectorPrincipal: SystemPrincipal = {
  id: "principal-1",
  account_id: "account-1",
  kind: "connector",
  name: "取込コネクタ",
  connector_id: "connector-1",
  revision: 2,
  created_at: "2026-04-01T00:00:00.000Z",
  updated_at: "2026-04-02T00:00:00.000Z",
}

const agentPrincipal: SystemPrincipal = {
  ...connectorPrincipal,
  kind: "agent",
  name: "取込エージェント",
  connector_id: null,
}

describe("SystemPrincipalDetailSection", () => {
  test("分類を日本語にし、Account とコネクタへ繋ぐ", async () => {
    mocks.getSystemPrincipal.mockResolvedValue(connectorPrincipal)

    render(await SystemPrincipalDetailSection({ principalId: "principal-1" }))

    expect(screen.getByText("取込コネクタ")).toBeDefined()
    expect(screen.getByText("コネクタ", { selector: "dd" })).toBeDefined()
    expect(screen.getByRole("link", { name: "account-1" }).getAttribute("href")).toBe(
      "/system/accounts",
    )
    expect(screen.getByRole("link", { name: "connector-1" }).getAttribute("href")).toBe(
      "/system/connectors/connector-1",
    )
  })

  test("コネクタを持たない Principal はハイフンにする", async () => {
    mocks.getSystemPrincipal.mockResolvedValue(agentPrincipal)

    render(await SystemPrincipalDetailSection({ principalId: "principal-1" }))

    expect(screen.getByText("エージェント")).toBeDefined()
    expect(screen.getByText("-")).toBeDefined()
    expect(screen.queryByRole("link", { name: "connector-1" })).toBeNull()
  })

  test("取得に失敗したときは属性を出さない", async () => {
    // api の GET は 404 と 500 を同じ Error にまとめるので、
    // 存在しない識別子もここでは取得失敗として出る。
    mocks.getSystemPrincipal.mockResolvedValue(new Error("failed"))

    render(await SystemPrincipalDetailSection({ principalId: "principal-9" }))

    expect(screen.getByText("Principal の取得に失敗しました")).toBeDefined()
    expect(screen.queryByText("取込コネクタ")).toBeNull()
  })
})
