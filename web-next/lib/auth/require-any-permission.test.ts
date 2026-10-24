import { describe, expect, test, vi } from "vite-plus/test"
import { requireAnyPermission } from "@/lib/auth/require-any-permission"

const mocks = vi.hoisted(() => ({
  getMe: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND")
  }),
}))

vi.mock("@/lib/api/get-me", () => ({ getMe: mocks.getMe }))
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }))

const companyRead = ["employee:read", "org:manage", "system:admin"] as const

describe("requireAnyPermission", () => {
  test("api が OR で許すどのキー 1 つでも通す", async () => {
    for (const permission of companyRead) {
      mocks.getMe.mockResolvedValue({ permissions: [permission] })

      const currentUser = await requireAnyPermission(companyRead)

      expect(currentUser.permissions).toEqual([permission])
    }

    expect(mocks.notFound).not.toHaveBeenCalled()
  })

  test("どれも持たない利用者は存在ごと隠す", async () => {
    mocks.getMe.mockResolvedValue({ permissions: ["expense:read:all"] })

    await expect(requireAnyPermission(companyRead)).rejects.toThrow("NOT_FOUND")
  })

  test("自身の情報を取得できないときも通さない", async () => {
    mocks.getMe.mockResolvedValue(new Error("failed"))

    await expect(requireAnyPermission(companyRead)).rejects.toThrow("NOT_FOUND")
  })
})
