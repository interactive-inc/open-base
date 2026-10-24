import { afterEach, describe, expect, test, vi } from "vite-plus/test"
import { apiFetch } from "@/lib/api/api-fetch"

const mocks = vi.hoisted(() => ({ getCloudflareContext: vi.fn() }))

vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: mocks.getCloudflareContext }))

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

describe("apiFetch", () => {
  test("Cloudflare の実行環境の外では公開 URL へ fetch する", async () => {
    mocks.getCloudflareContext.mockImplementation(() => {
      throw new Error("not running on Cloudflare")
    })
    const fetchMock = vi.fn().mockResolvedValue(new Response("ok"))
    vi.stubGlobal("fetch", fetchMock)

    await apiFetch("https://api.example.com/system/health")

    expect(fetchMock).toHaveBeenCalledWith("https://api.example.com/system/health", undefined)
  })

  test("service binding が無ければ公開 URL へ fetch する", async () => {
    mocks.getCloudflareContext.mockReturnValue({ env: {} })
    const fetchMock = vi.fn().mockResolvedValue(new Response("ok"))
    vi.stubGlobal("fetch", fetchMock)

    await apiFetch("https://api.example.com/system/health", { method: "GET" })

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  test("service binding があれば同じ要求を binding へ送り、公開 URL を使わない", async () => {
    const binding = { fetch: vi.fn().mockResolvedValue(new Response("ok")) }
    mocks.getCloudflareContext.mockReturnValue({ env: { API_SERVICE: binding } })
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    await apiFetch("https://api.example.com/system/sessions", {
      method: "PATCH",
      headers: { Authorization: "Bearer fixture", "content-type": "application/json" },
      body: JSON.stringify({ refresh_token: "fixture" }),
    })

    expect(fetchMock).not.toHaveBeenCalled()
    const request = binding.fetch.mock.calls[0]?.[0] as Request
    expect(request.url).toBe("https://api.example.com/system/sessions")
    expect(request.method).toBe("PATCH")
    expect(request.headers.get("Authorization")).toBe("Bearer fixture")
    expect(await request.json()).toEqual({ refresh_token: "fixture" })
  })
})
