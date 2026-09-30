import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, test, vi } from "vite-plus/test"
import type { SystemMachineCredential } from "@/lib/api/types/system-operation-types"
import { SystemMachineCredentialSection } from "@/app/(app)/system/principals/[principalId]/_components/system-machine-credential-section"

const mocks = vi.hoisted(() => ({ getSystemMachineCredentials: vi.fn() }))

vi.mock("@/lib/api/get-system-machine-credentials", () => ({
  getSystemMachineCredentials: mocks.getSystemMachineCredentials,
}))
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const activeCredential: SystemMachineCredential = {
  id: "credential-1",
  principal_id: "principal-1",
  name: "取込用",
  status: "active",
  created_at: "2026-04-01T00:00:00.000Z",
  updated_at: "2026-04-01T00:00:00.000Z",
  expires_at: "2026-10-01T00:00:00.000Z",
  last_used_at: null,
  revoked_at: null,
}

describe("SystemMachineCredentialSection", () => {
  test("状態を日本語にし、未使用の時刻はハイフンにする", async () => {
    mocks.getSystemMachineCredentials.mockResolvedValue([activeCredential])

    render(await SystemMachineCredentialSection({ principalId: "principal-1" }))

    expect(screen.getByRole("cell", { name: "取込用" })).toBeDefined()
    expect(screen.getByRole("cell", { name: "有効" })).toBeDefined()
    expect(screen.getAllByRole("cell", { name: "-" })).toHaveLength(2)
  })

  test("1 件も無いときは発行の手段を示す", async () => {
    mocks.getSystemMachineCredentials.mockResolvedValue([])

    render(await SystemMachineCredentialSection({ principalId: "principal-1" }))

    expect(screen.getByText("機械 credential がありません")).toBeDefined()
    expect(screen.queryByRole("table")).toBeNull()
  })

  test("取得に失敗したときは行を出さない", async () => {
    mocks.getSystemMachineCredentials.mockResolvedValue(new Error("failed"))

    render(await SystemMachineCredentialSection({ principalId: "principal-1" }))

    expect(screen.getByText("機械 credential の取得に失敗しました")).toBeDefined()
    expect(screen.queryByRole("table")).toBeNull()
  })
})
