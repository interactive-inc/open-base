import { InvalidCompanyActorError } from "@/contexts/company/domain/errors"
import { CompanyActorValue } from "@/contexts/company/domain/values/company-actor.value"
import { describe, expect, test } from "bun:test"

describe("CompanyActorValue", () => {
  test("owns organization scope and capability checks", () => {
    const actor = CompanyActorValue.restore({
      accountId: "c0975461-26d2-43a1-86d2-124bd000d9c9",
      employeeId: "b4b9edaa-1e08-46d5-b0bc-1798cc369fd1",
      organizationIds: ["01900060-0000-7000-8000-e53d7d4223a9"],
      capabilities: ["company:read"],
    })

    expect(actor.canAccessOrganization("01900060-0000-7000-8000-e53d7d4223a9")).toBe(true)
    expect(actor.canAccessOrganization("01900060-0000-7000-8000-b4069a636599")).toBe(false)
    expect(actor.hasCapability("company:read")).toBe(true)
    expect(actor.hasCapability("company:write")).toBe(false)
    expect(actor.canUpdateWorkforce()).toBe(false)
    expect(Object.isFrozen(actor)).toBe(true)
    expect(Object.isFrozen(actor.organizationIds)).toBe(true)
  })

  test("company administrator satisfies every Company capability", () => {
    const actor = CompanyActorValue.restore({
      accountId: "c0975461-26d2-43a1-86d2-124bd000d9c9",
      employeeId: null,
      organizationIds: ["*"],
      capabilities: ["company:admin"],
    })

    expect(actor.canAccessOrganization("01900060-0000-7000-8000-974d7bba80bb")).toBe(true)
    expect(actor.hasCapability("company:read")).toBe(true)
    expect(actor.hasCapability("company:write")).toBe(true)
    expect(actor.canUpdateWorkforce()).toBe(true)
  })

  test("workforce update does not imply broad Company write", () => {
    const actor = CompanyActorValue.restore({
      accountId: "76e2eea1-f607-4020-90cf-7433ebf4d242",
      employeeId: null,
      organizationIds: ["01900060-0000-7000-8000-e53d7d4223a9"],
      capabilities: ["company:workforce:update"],
    })

    expect(actor.canUpdateWorkforce()).toBe(true)
    expect(actor.hasCapability("company:write")).toBe(false)
  })

  test("rejects ambiguous or duplicated actor claims", () => {
    expect(() =>
      CompanyActorValue.restore({
        accountId: "c0975461-26d2-43a1-86d2-124bd000d9c9",
        employeeId: null,
        organizationIds: [
          "01900060-0000-7000-8000-e53d7d4223a9",
          "01900060-0000-7000-8000-e53d7d4223a9",
        ],
        capabilities: ["company:read"],
      }),
    ).toThrow(InvalidCompanyActorError)
  })
})
