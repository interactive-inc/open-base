import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, test, vi } from "vite-plus/test"
import { SystemHealthSection } from "@/app/(app)/system/health/_components/system-health-section"

const mocks = vi.hoisted(() => ({ getSystemHealth: vi.fn() }))

vi.mock("@/lib/api/get-system-health", () => ({ getSystemHealth: mocks.getSystemHealth }))
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe("SystemHealthSection", () => {
  test("ok を正常と出す", async () => {
    mocks.getSystemHealth.mockResolvedValue("ok")

    render(await SystemHealthSection())

    expect(screen.getByText("正常")).toBeDefined()
  })

  test("ok 以外は api の応答をそのまま出す", async () => {
    mocks.getSystemHealth.mockResolvedValue("degraded")

    render(await SystemHealthSection())

    expect(screen.getByText("degraded")).toBeDefined()
  })

  test("到達できないときは取得失敗として示す", async () => {
    mocks.getSystemHealth.mockResolvedValue(new Error("failed"))

    render(await SystemHealthSection())

    expect(screen.getByText("health の取得に失敗しました")).toBeDefined()
    expect(screen.queryByText("正常")).toBeNull()
  })
})
