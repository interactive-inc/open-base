import { afterEach, expect, test, vi } from "vite-plus/test"
import { getFeatureAvailability } from "@/lib/api/get-feature-availability"

const request = vi.hoisted(() => vi.fn())
vi.mock("@/lib/api/hc-client", () => ({
  createClient: async () => ({ company: { features: { $get: request } } }),
}))
afterEach(() => vi.resetAllMocks())

test("明示された無効機能を保持し、正常な空配列だけを全機能有効とする", async () => {
  request.mockResolvedValueOnce(Response.json({ disabled_features: ["leave", "knowledge"] }))
  expect(await getFeatureAvailability()).toEqual(["leave", "knowledge"])
  request.mockResolvedValueOnce(Response.json({ disabled_features: [] }))
  expect(await getFeatureAvailability()).toEqual([])
})

test.each([401, 403, 404, 500, 503])("HTTP %iを全機能有効へ変換しない", async (status) => {
  request.mockResolvedValue(Response.json({ error: "unavailable" }, { status }))
  expect(await getFeatureAvailability()).toBeInstanceOf(Error)
})

test.each([{}, { disabled_features: null }, { disabled_features: [1] }])(
  "不正な設定レスポンスを拒否する",
  async (body) => {
    request.mockResolvedValue(Response.json(body))
    expect(await getFeatureAvailability()).toBeInstanceOf(Error)
  },
)

test("JSONとして解釈できないレスポンスを拒否する", async () => {
  request.mockResolvedValue(new Response("unavailable"))
  expect(await getFeatureAvailability()).toBeInstanceOf(Error)
})
