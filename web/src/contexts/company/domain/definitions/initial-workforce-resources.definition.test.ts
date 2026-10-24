import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { initialWorkforceResources } from "@/contexts/company/domain/definitions/initial-workforce-resources.definition"
import { deterministicCompanyId } from "@/contexts/company/domain/definitions/deterministic-company-id.definition"
import { expect, test } from "bun:test"

const declaration = {
  employeeId: "9e174baf-3240-4253-9cba-16bc3e431cca",
  employmentId: "e7173538-06d6-4031-9c04-9915e8eaebbc",
  officialName: "Example Person",
  employeeCode: "E001",
  email: "you@example.com",
  phone: null,
  employmentType: "PART_TIME",
  status: "leave",
  effectiveOn: restoreCalendarDate("2026-09-01"),
} as const
const personId = deterministicCompanyId("person", declaration.employeeId)

test("人、従業員、雇用を同じ開始日の最初の版として組み立てる", () => {
  const resources = initialWorkforceResources(declaration)

  expect(resources.map((resource) => [resource.type, resource.id, resource.revision])).toEqual([
    ["person", personId, 1],
    ["employee", "9e174baf-3240-4253-9cba-16bc3e431cca", 1],
    ["employment", "e7173538-06d6-4031-9c04-9915e8eaebbc", 1],
  ])
  expect(resources.every((resource) => resource.effectiveFrom === "2026-09-01")).toBe(true)
  expect(resources[1]?.attributes).toEqual({
    personId,
    employeeCode: "E001",
  })
  expect(resources[2]?.attributes).toEqual({
    employeeId: "9e174baf-3240-4253-9cba-16bc3e431cca",
    employmentType: "PART_TIME",
    status: "ON_LEAVE",
  })
})

test("Accountとの対応は、宣言された開始日で加える", () => {
  const resources = initialWorkforceResources({
    ...declaration,
    accountLink: {
      accountId: "f3b9abc8-e975-4769-98eb-ffca70786ee5",
      effectiveOn: restoreCalendarDate("2026-09-15"),
    },
  })

  expect(resources.at(-1)).toMatchObject({
    type: "account-employee-link",
    id: deterministicCompanyId("account-link", declaration.employeeId),
    effectiveFrom: "2026-09-15",
    attributes: {
      accountId: "f3b9abc8-e975-4769-98eb-ffca70786ee5",
      employeeId: "9e174baf-3240-4253-9cba-16bc3e431cca",
    },
  })
})
