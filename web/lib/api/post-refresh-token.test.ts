import { afterEach, expect, test, vi } from "vite-plus/test"
import { postRefreshToken } from "@/lib/api/post-refresh-token"

const mocks = vi.hoisted(() => ({ apiFetch: vi.fn() }))
vi.mock("@/lib/api/api-fetch", () => ({ apiFetch: mocks.apiFetch }))

afterEach(() => vi.restoreAllMocks())

test.each([
  new TypeError("connection refused"),
  new DOMException("request timed out", "TimeoutError"),
])("returns a safe failure when transport rejects: %s", async (failure) => {
  mocks.apiFetch.mockRejectedValueOnce(failure)

  expect(await postRefreshToken("example-refresh")).toBeInstanceOf(Error)
})

test.each(["not-json", "null", '{"access_token":17}', '{"access_token":""}'])(
  "rejects an invalid success response: %s",
  async (body) => {
    mocks.apiFetch.mockResolvedValueOnce(new Response(body, { status: 200 }))

    expect(await postRefreshToken("example-refresh")).toBeInstanceOf(Error)
  },
)

test("keeps rotated tokens on success", async () => {
  mocks.apiFetch.mockResolvedValueOnce(
    Response.json({ access_token: "example-access", refresh_token: "example-rotated" }),
  )

  expect(await postRefreshToken("example-refresh")).toEqual({
    access_token: "example-access",
    refresh_token: "example-rotated",
  })
})

test("bounds a stalled transport and returns a safe failure", async () => {
  const timeout = AbortSignal.timeout.bind(AbortSignal)
  const timeoutSpy = vi.spyOn(AbortSignal, "timeout").mockImplementation(() => timeout(5))
  mocks.apiFetch.mockImplementationOnce(
    (_input: unknown, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true })
      }),
  )

  expect(await postRefreshToken("example-refresh")).toBeInstanceOf(Error)
  expect(timeoutSpy).toHaveBeenCalledWith(10_000)
})
