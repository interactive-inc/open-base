import { afterEach, describe, expect, test, vi } from "vite-plus/test"
import { createClient } from "@/lib/api/hc-client"

const mocks = vi.hoisted(() => ({ getServerSession: vi.fn() }))

vi.mock("@/lib/auth/get-server-session", () => ({
  getServerSession: mocks.getServerSession,
}))

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

describe("createClient", () => {
  test.each([
    [null, null],
    ["fixture-session", "Bearer fixture-session"],
  ])("always identifies the Web client and conditionally sends Bearer", async (session, bearer) => {
    mocks.getServerSession.mockResolvedValue(session)
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        Response.json({ data: [], next_cursor: null, previous_cursor: null }, { status: 200 }),
      )
    vi.stubGlobal("fetch", fetchMock)

    const client = await createClient()
    await client["company"]["audit-events"].$get()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const request = new Request(fetchMock.mock.calls[0]?.[0], fetchMock.mock.calls[0]?.[1])
    expect(request.headers.get("X-Open-Base-Client")).toBe("web")
    expect(request.headers.get("Authorization")).toBe(bearer)
  })

  test("keeps the network TypeError guard as a safe 503 response", async () => {
    mocks.getServerSession.mockResolvedValue(null)
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fixture network failure")))

    const client = await createClient()
    const response = await client["company"]["audit-events"].$get()

    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: "api unreachable" })
  })
})
