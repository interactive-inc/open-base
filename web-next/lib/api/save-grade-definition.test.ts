import { afterEach, expect, test, vi } from "vite-plus/test"
import { saveGradeDefinition } from "@/lib/api/save-grade-definition"
import type { GradeDefinitionCommand } from "@/lib/api/types/grade-types"

vi.mock("@/lib/auth/get-server-session", () => ({
  getServerSession: async () => "fixture-session",
}))
afterEach(() => vi.unstubAllGlobals())

const command: GradeDefinitionCommand = {
  commandId: "command:grade",
  expectedRevision: 7,
  reason: "Confirmed correction",
  resource: {
    organizationId: "ad4f6cb1-774b-43ae-950f-80e9bc67c66d",
    type: "grade",
    id: "grade:test",
    revision: 3,
    state: "active",
    effectiveFrom: "2030-01-01",
    effectiveTo: null,
    attributes: { code: "G1", officialName: "Grade", rank: null, description: null },
  },
}

test("retries preserve the exact command, version and key without fetching a newer definition", async () => {
  const requests: Request[] = []
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      requests.push(new Request(input, init))
      return Response.json({
        organizationId: "ad4f6cb1-774b-43ae-950f-80e9bc67c66d",
        organizationRevision: 8,
        replayed: requests.length > 1,
      })
    }),
  )
  for (const retry of [false, true])
    expect(await saveGradeDefinition(command)).toMatchObject({ replayed: retry })
  expect(requests).toHaveLength(2)
  for (const request of requests) {
    expect(new URL(request.url).pathname).toBe("/company/definitions")
    expect(request.method).toBe("POST")
    expect(request.headers.get("if-match")).toBe("7")
    expect(request.headers.get("idempotency-key")).toBe(command.commandId)
    expect(await request.json()).toEqual({ reason: command.reason, resources: [command.resource] })
  }
})
test("conflict is returned without changing the approved conditions", async () => {
  const fetchMock = vi.fn(async () =>
    Response.json({ detail: "company_revision_conflict" }, { status: 409 }),
  )
  vi.stubGlobal("fetch", fetchMock)
  expect(await saveGradeDefinition(command)).toBeInstanceOf(Error)
  expect(fetchMock).toHaveBeenCalledTimes(1)
})
