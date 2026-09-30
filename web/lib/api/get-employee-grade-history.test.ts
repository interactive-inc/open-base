import { afterEach, expect, test, vi } from "vite-plus/test"
import { getEmployeeGradeHistory } from "@/lib/api/get-employee-grade-history"

vi.mock("@/lib/auth/get-server-session", () => ({
  getServerSession: async () => "fixture-session",
}))
afterEach(() => vi.unstubAllGlobals())

const employee = {
  code: "E001",
  name: "Person",
  profile: {
    employeeId: "employee:test",
    organizationRevision: 7,
    personRevision: 1,
    effectiveOn: "2030-01-01",
  },
  dept_name: null,
  position: null,
  email: "you@example.com",
  status: "active",
}
const revision = {
  id: "assignment:test",
  revision: 1,
  organizationRevision: 2,
  state: "active",
  effectiveFrom: "2030-01-01",
  effectiveTo: null,
  employeeId: "employee:test",
  employmentId: "employment:test",
  gradeId: "grade:test",
  commandId: "command:test",
  actorAccountId: "account:test",
  reason: "Confirmed",
  recordedAt: 1,
}

test("all pages keep the observed company revision and missing archive does not become empty source evidence", async () => {
  const offsets: string[] = []
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init)
    const url = new URL(request.url)
    if (url.pathname === "/company/employee-directory/E001") return Response.json(employee)
    if (url.pathname === "/company/grade-award-archives/by-employee/employee:test")
      return Response.json({ error: "missing" }, { status: 404 })
    expect(url.pathname).toBe("/company/grade-assignment-history")
    expect(request.headers.get("x-company-organization-id")).toBe(
      "ad4f6cb1-774b-43ae-950f-80e9bc67c66d",
    )
    expect(url.searchParams.get("organization_revision")).toBe("7")
    expect(url.searchParams.get("employee_id")).toBe("employee:test")
    const offset = url.searchParams.get("offset")!
    offsets.push(offset)
    expect(["0", "1"]).toContain(offset)
    return Response.json({
      organizationId: "ad4f6cb1-774b-43ae-950f-80e9bc67c66d",
      organizationRevision: 7,
      employeeId: "employee:test",
      revisions: [{ ...revision, revision: Number(offset) + 1 }],
      nextOffset: offset === "0" ? 1 : null,
    })
  })
  vi.stubGlobal("fetch", fetchMock)
  expect(await getEmployeeGradeHistory("E001")).toMatchObject({
    companyRevision: 7,
    revisions: [{ revision: 1 }, { revision: 2 }],
    archive: null,
  })
  expect(offsets).toEqual(["0", "1"])
  expect(fetchMock).toHaveBeenCalledTimes(4)
})

test.each([
  "changed-revision",
  "changed-employee",
  "stalled-page",
  "storage-failure",
  "archive-forbidden",
  "unconnected",
])("rejects %s without falling back to the old ledger", async (failure) => {
  const paths: string[] = []
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(new Request(input, init).url)
      paths.push(url.pathname)
      if (url.pathname === "/company/employee-directory/E001")
        return Response.json({
          ...employee,
          profile: failure === "unconnected" ? null : employee.profile,
        })
      if (url.pathname === "/company/grade-award-archives/by-employee/employee:test")
        return Response.json(
          { error: "missing" },
          { status: failure === "archive-forbidden" ? 403 : 404 },
        )
      expect(url.pathname).toBe("/company/grade-assignment-history")
      if (failure === "storage-failure")
        return Response.json({ error: "unavailable" }, { status: 503 })
      return Response.json({
        organizationId: "ad4f6cb1-774b-43ae-950f-80e9bc67c66d",
        organizationRevision: failure === "changed-revision" ? 8 : 7,
        employeeId: failure === "changed-employee" ? "employee:other" : "employee:test",
        revisions: [revision],
        nextOffset: failure === "stalled-page" ? 0 : null,
      })
    }),
  )
  expect(await getEmployeeGradeHistory("E001")).toBeInstanceOf(Error)
  expect(paths).not.toContain("/company/employee-grades")
  expect(paths).not.toContain("/company/grade-definitions")
})
