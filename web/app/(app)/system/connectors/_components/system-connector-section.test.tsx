import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, test, vi } from "vite-plus/test"
import type { SystemConnector } from "@/lib/api/types/system-operation-types"
import { SystemConnectorSection } from "@/app/(app)/system/connectors/_components/system-connector-section"

const mocks = vi.hoisted(() => ({ getSystemConnectors: vi.fn() }))

vi.mock("@/lib/api/get-system-connectors", () => ({
  getSystemConnectors: mocks.getSystemConnectors,
}))
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const activeConnector: SystemConnector = {
  id: "connector-1",
  key: "payroll_export",
  name: "給与の連携",
  direction: "outbound",
  transport: "api",
  status: "active",
  revision: 1,
}

const disabledConnector: SystemConnector = {
  id: "connector-2",
  key: "attendance_import",
  name: "勤怠の取込",
  direction: "inbound",
  transport: "file",
  status: "disabled",
  revision: 3,
}

describe("SystemConnectorSection", () => {
  test("向き・transport・状態を日本語にし、名称を詳細へ繋ぐ", async () => {
    mocks.getSystemConnectors.mockResolvedValue([activeConnector, disabledConnector])

    render(await SystemConnectorSection())

    expect(screen.getByRole("cell", { name: "送信" })).toBeDefined()
    expect(screen.getByRole("cell", { name: "受信" })).toBeDefined()
    expect(screen.getByRole("cell", { name: "ファイル" })).toBeDefined()
    expect(screen.getByRole("cell", { name: "停止" })).toBeDefined()
    expect(screen.getByRole("link", { name: "給与の連携" }).getAttribute("href")).toBe(
      "/system/connectors/connector-1",
    )
  })

  test("1 件も無いときは登録の手段を示す", async () => {
    mocks.getSystemConnectors.mockResolvedValue([])

    render(await SystemConnectorSection())

    expect(screen.getByText("コネクタが登録されていません")).toBeDefined()
    expect(screen.queryByRole("table")).toBeNull()
  })

  test("取得に失敗したときは行を出さない", async () => {
    mocks.getSystemConnectors.mockResolvedValue(new Error("failed"))

    render(await SystemConnectorSection())

    expect(screen.getByText("コネクタの取得に失敗しました")).toBeDefined()
    expect(screen.queryByRole("table")).toBeNull()
  })
})
