import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, test, vi } from "vite-plus/test"
import type { SystemPermissionDefinition } from "@/lib/api/types/system-operation-types"
import { SystemPermissionDefinitionSection } from "@/app/(app)/system/permission-definitions/_components/system-permission-definition-section"

const mocks = vi.hoisted(() => ({ getSystemPermissionDefinitions: vi.fn() }))

vi.mock("@/lib/api/get-system-permission-definitions", () => ({
  getSystemPermissionDefinitions: mocks.getSystemPermissionDefinitions,
}))
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const definition: SystemPermissionDefinition = {
  key: "iam:read",
  description: "アカウントとロールを読む",
  category: "システム",
}

describe("SystemPermissionDefinitionSection", () => {
  test("キーと分類と説明を並べる", async () => {
    mocks.getSystemPermissionDefinitions.mockResolvedValue([definition])

    render(await SystemPermissionDefinitionSection())

    expect(screen.getByRole("cell", { name: "iam:read" })).toBeDefined()
    expect(screen.getByRole("cell", { name: "システム" })).toBeDefined()
    expect(screen.getByRole("cell", { name: "アカウントとロールを読む" })).toBeDefined()
  })

  test("1 件も無いときは有効な機能が無いことを示す", async () => {
    mocks.getSystemPermissionDefinitions.mockResolvedValue([])

    render(await SystemPermissionDefinitionSection())

    expect(screen.getByText("権限定義がありません")).toBeDefined()
    expect(screen.queryByRole("table")).toBeNull()
  })

  test("取得に失敗したときは行を出さない", async () => {
    mocks.getSystemPermissionDefinitions.mockResolvedValue(new Error("failed"))

    render(await SystemPermissionDefinitionSection())

    expect(screen.getByText("権限定義の取得に失敗しました")).toBeDefined()
    expect(screen.queryByRole("table")).toBeNull()
  })
})
