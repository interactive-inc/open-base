import { beforeEach, describe, expect, it, vi } from "vite-plus/test"
import { getCompanyDefinitionResources } from "@/lib/api/get-company-definition-resources"
import { getPersonnelPositionSnapshot } from "@/lib/api/get-personnel-position-snapshot"
import type { CompanyResource } from "@/lib/api/types/company-resource-types"

vi.mock("@/lib/api/get-company-definition-resources", () => ({
  getCompanyDefinitionResources: vi.fn(),
}))

const position: CompanyResource = {
  organizationId: "ad4f6cb1-774b-43ae-950f-80e9bc67c66d",
  type: "position",
  id: "position:coordinator",
  revision: 3,
  state: "active",
  effectiveFrom: "2026-01-01",
  effectiveTo: null,
  attributes: { code: "COORDINATOR", officialName: "Coordinator" },
}

beforeEach(() => vi.clearAllMocks())

describe("getPersonnelPositionSnapshot", () => {
  it("keeps options and revision from the same Company read", async () => {
    vi.mocked(getCompanyDefinitionResources).mockResolvedValue({
      organizationId: position.organizationId,
      organizationRevision: 8,
      resources: [
        position,
        { ...position, id: "void-position", state: "void" },
        { ...position, id: "grade", type: "grade" },
      ],
    })
    expect(await getPersonnelPositionSnapshot()).toEqual({
      companyRevision: 8,
      positions: [{ id: position.id, code: "COORDINATOR", name: "Coordinator" }],
    })
    expect(getCompanyDefinitionResources).toHaveBeenCalledTimes(1)
  })

  it("requests the confirmed revision at the event date and rejects a substituted revision", async () => {
    const snapshot = { organizationRevision: 8, effectiveOn: "2026-02-01" }
    vi.mocked(getCompanyDefinitionResources).mockResolvedValue({
      organizationId: position.organizationId,
      organizationRevision: 8,
      resources: [position],
    })
    expect(await getPersonnelPositionSnapshot(snapshot)).toMatchObject({ companyRevision: 8 })
    expect(getCompanyDefinitionResources).toHaveBeenCalledWith(snapshot)
    vi.mocked(getCompanyDefinitionResources).mockResolvedValue({
      organizationId: position.organizationId,
      organizationRevision: 9,
      resources: [position],
    })
    expect(await getPersonnelPositionSnapshot(snapshot)).toBeInstanceOf(Error)
  })

  it("fails closed on unavailable or malformed source information", async () => {
    const unavailable = new Error("unavailable")
    vi.mocked(getCompanyDefinitionResources).mockResolvedValue(unavailable)
    expect(await getPersonnelPositionSnapshot()).toBe(unavailable)
    vi.mocked(getCompanyDefinitionResources).mockResolvedValue({
      organizationId: position.organizationId,
      organizationRevision: 8,
      resources: [{ ...position, attributes: { code: "COORDINATOR" } }],
    })
    expect(await getPersonnelPositionSnapshot()).toBeInstanceOf(Error)
  })
})
