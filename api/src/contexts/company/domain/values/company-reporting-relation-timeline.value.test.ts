import { describe, expect, test } from "bun:test"
import { CompanyReportingRelationTimelineValue } from "@/contexts/company/domain/values/company-reporting-relation-timeline.value"
import {
  CompanyResourceEntity,
  type CompanyResourceProps,
} from "@/contexts/company/domain/entities/company-resource.entity"
import { CompanyResourceValidationError } from "@/contexts/company/domain/errors"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

const january = restoreCalendarDate("2030-01-01")
const february = restoreCalendarDate("2030-02-01")
const march = restoreCalendarDate("2030-03-01")

function relation(id: string, manager: string, overrides: Partial<CompanyResourceProps> = {}) {
  const resource = CompanyResourceEntity.create({
    organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
    type: "reporting-relation",
    id,
    revision: 1,
    state: "active",
    effectiveFrom: january,
    effectiveTo: null,
    attributes: {
      employeeId: id,
      managerEmployeeId: manager,
      organizationUnitId: "0190005f-0000-7000-8000-3d39a82ae356",
    },
    ...overrides,
  })
  if (resource instanceof Error) throw resource
  return resource
}

function hasCycle(history: ReadonlyArray<CompanyResourceEntity>) {
  const timeline = CompanyReportingRelationTimelineValue.create(history)
  if (timeline instanceof Error) throw timeline
  return timeline.hasManagementCycle()
}

describe("CompanyReportingRelationTimelineValue", () => {
  test("allows an empty history and rejects histories from different organizations", () => {
    expect(hasCycle([])).toBe(false)
    expect(
      CompanyReportingRelationTimelineValue.create([
        relation("a", "b"),
        relation("b", "a", { organizationId: "01900060-0000-7000-8000-12268fccf2cc" }),
      ]),
    ).toBeInstanceOf(CompanyResourceValidationError)
  })

  test("includes earlier versions when a future change replaces the head", () => {
    expect(
      hasCycle([
        relation("a", "b"),
        relation("a", "c", { revision: 2, effectiveFrom: march }),
        relation("b", "a", { effectiveTo: february }),
      ]),
    ).toBe(true)
  })

  test("preserves the earlier period of a future void", () => {
    expect(
      hasCycle([
        relation("a", "b"),
        relation("a", "b", { revision: 2, state: "void", effectiveFrom: march }),
        relation("b", "a", { effectiveTo: february }),
      ]),
    ).toBe(true)
  })

  test("prefers a later effective date even when an earlier correction has a higher revision", () => {
    const history = [
      relation("a", "b"),
      relation("a", "b", { revision: 2, effectiveFrom: march }),
      relation("a", "c", { revision: 3 }),
    ]
    expect(hasCycle([...history, relation("b", "a", { effectiveTo: march })])).toBe(false)
    expect(hasCycle([...history, relation("b", "a", { effectiveFrom: march })])).toBe(true)
  })

  test("uses the highest revision at the same start date regardless of input order", () => {
    const history = [relation("a", "b"), relation("a", "c", { revision: 2 }), relation("b", "a")]
    expect(hasCycle(history)).toBe(false)
    expect(hasCycle(history.toReversed())).toBe(false)
  })

  test("keeps a gap and does not extend a relation to the next version", () => {
    expect(
      hasCycle([
        relation("a", "b", { effectiveTo: february }),
        relation("a", "b", { revision: 2, effectiveFrom: march }),
        relation("b", "a", { effectiveFrom: february, effectiveTo: march }),
      ]),
    ).toBe(false)
  })

  test("does not revive an earlier version after a newer void or active version expires", () => {
    const states: ReadonlyArray<CompanyResourceProps["state"]> = ["active", "void"]
    for (const state of states) {
      expect(
        hasCycle([
          relation("a", "b"),
          relation("a", "c", { revision: 2, state, effectiveFrom: february, effectiveTo: march }),
          relation("b", "a", { effectiveFrom: march }),
        ]),
      ).toBe(false)
    }
  })
})
