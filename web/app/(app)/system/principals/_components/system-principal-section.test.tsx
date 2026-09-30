import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, test, vi } from "vite-plus/test"
import type { SystemPrincipal } from "@/lib/api/types/system-operation-types"
import { SystemPrincipalSection } from "@/app/(app)/system/principals/_components/system-principal-section"

const mocks = vi.hoisted(() => ({ getSystemPrincipals: vi.fn() }))

vi.mock("@/lib/api/get-system-principals", () => ({
  getSystemPrincipals: mocks.getSystemPrincipals,
}))
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const humanPrincipal: SystemPrincipal = {
  id: "principal-1",
  account_id: "account-1",
  kind: "human",
  name: "担当者",
  connector_id: null,
  revision: 1,
  created_at: "2026-04-01T00:00:00.000Z",
  updated_at: "2026-04-01T00:00:00.000Z",
}

const connectorPrincipal: SystemPrincipal = {
  id: "principal-2",
  account_id: "account-2",
  kind: "connector",
  name: "取込コネクタ",
  connector_id: "connector-1",
  revision: 2,
  created_at: "2026-05-01T00:00:00.000Z",
  updated_at: "2026-05-02T00:00:00.000Z",
}

describe("SystemPrincipalSection", () => {
  test("分類を日本語にし、名称を詳細へ繋ぐ", async () => {
    mocks.getSystemPrincipals.mockResolvedValue([humanPrincipal, connectorPrincipal])

    render(await SystemPrincipalSection())

    expect(screen.getByRole("cell", { name: "人" })).toBeDefined()
    expect(screen.getByRole("cell", { name: "コネクタ" })).toBeDefined()
    expect(screen.getByRole("link", { name: "担当者" }).getAttribute("href")).toBe(
      "/system/principals/principal-1",
    )
    expect(screen.getAllByRole("row").slice(1)).toHaveLength(2)
  })

  test("コネクタを持たない Principal はハイフンにする", async () => {
    mocks.getSystemPrincipals.mockResolvedValue([humanPrincipal])

    render(await SystemPrincipalSection())

    expect(screen.getByText("-")).toBeDefined()
    expect(screen.queryByRole("link", { name: "connector-1" })).toBeNull()
  })

  test("コネクタを持つ Principal はコネクタ画面へ繋ぐ", async () => {
    mocks.getSystemPrincipals.mockResolvedValue([connectorPrincipal])

    render(await SystemPrincipalSection())

    expect(screen.getByRole("link", { name: "connector-1" }).getAttribute("href")).toBe(
      "/system/connectors/connector-1",
    )
  })

  test("1 件も無いときは登録の手段を示す", async () => {
    mocks.getSystemPrincipals.mockResolvedValue([])

    render(await SystemPrincipalSection())

    expect(screen.getByText("Principal が登録されていません")).toBeDefined()
    expect(screen.queryByRole("table")).toBeNull()
  })

  test("取得に失敗したときは行を出さない", async () => {
    mocks.getSystemPrincipals.mockResolvedValue(new Error("failed"))

    render(await SystemPrincipalSection())

    expect(screen.getByText("Principal の取得に失敗しました")).toBeDefined()
    expect(screen.queryByRole("table")).toBeNull()
  })
})
