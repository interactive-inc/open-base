import { afterEach, expect, test, vi } from "vite-plus/test"
import { deleteRole } from "@/lib/api/delete-role"
import { getOrgDepartment } from "@/lib/api/get-org-department"

const mocks = vi.hoisted(() => ({ apiFetch: vi.fn() }))
vi.mock("@/lib/api/api-fetch", () => ({ apiFetch: mocks.apiFetch }))
vi.mock("@/lib/auth/get-server-session", () => ({ getServerSession: async () => "example-access" }))
afterEach(() => vi.clearAllMocks())

test("role deletion cannot reinterpret an ID as another API path", async () => {
  mocks.apiFetch.mockResolvedValue(new Response(null, { status: 204 }))
  const roleId = "../../company/approval-delegations/example"
  expect(await deleteRole(roleId, null)).toBeNull()
  const input = mocks.apiFetch.mock.calls[0]?.[0]
  expect(new URL(input).pathname).toBe("/system/roles/" + encodeURIComponent(roleId))
})

test("department codes preserve URL delimiters and Unicode as one segment", async () => {
  mocks.apiFetch.mockResolvedValue(Response.json({ code: "研究/開発?#%" }))
  await getOrgDepartment("研究/開発?#%")
  const input = mocks.apiFetch.mock.calls[0]?.[0]
  const url = new URL(input)
  expect(url.pathname).toBe("/company/organization-units/" + encodeURIComponent("研究/開発?#%"))
  expect(url.search).toBe("")
  expect(url.hash).toBe("")
})

test("a standalone dot segment is rejected without sending a mutation", async () => {
  await expect(deleteRole("..", null)).rejects.toThrow("invalid URL path parameter")
  expect(mocks.apiFetch).not.toHaveBeenCalled()
})
