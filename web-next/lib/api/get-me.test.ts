import { afterEach, describe, expect, test, vi } from "vite-plus/test"
import { AuthError } from "@/lib/api/auth-error"
import { getMe } from "@/lib/api/get-me"

const mocks = vi.hoisted(() => ({ getServerSession: vi.fn() }))

vi.mock("@/lib/auth/get-server-session", () => ({
  getServerSession: mocks.getServerSession,
}))

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

describe("getMe", () => {
  test("session cookie が無ければ API を呼ばずに AuthError にする", async () => {
    mocks.getServerSession.mockResolvedValue(null)
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    await expect(getMe()).rejects.toBeInstanceOf(AuthError)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  test("API が 401 を返せば AuthError にする", async () => {
    mocks.getServerSession.mockResolvedValue("fixture-session")
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({ error: "unauthorized" }, { status: 401 })),
    )

    await expect(getMe()).rejects.toBeInstanceOf(AuthError)
  })

  test("API の障害は AuthError ではない失敗にする", async () => {
    mocks.getServerSession.mockResolvedValue("fixture-session")
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({}, { status: 503 })))

    const failure = await getMe().catch((error: unknown) => error)

    expect(failure).toBeInstanceOf(Error)
    expect(failure).not.toBeInstanceOf(AuthError)
  })
})
