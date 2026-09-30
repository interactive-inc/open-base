import { testDerivedId } from "@system/test/system-test-id.test-support"
import type { CompanyResourceProps } from "@/contexts/company/domain/entities/company-resource.entity"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { createCompanyPlaceTestContext } from "@/contexts/company/test/company-place.test-support"

/** 独立した二人の在籍と、組織を指定した上長関係の履歴を検証する。 */
export async function createCompanyReportingReferenceTestContext(schemaSql?: string) {
  const company = await createCompanyPlaceTestContext(schemaSql)
  const people = ["worker", "manager"].flatMap(
    (id): ReadonlyArray<CompanyResourceProps> => [
      {
        ...company.common,
        type: "person",
        id: `person:${id}`,
        attributes: { officialName: id },
      },
      {
        ...company.common,
        type: "employee",
        id: testDerivedId("employee", id),
        attributes: { personId: `person:${id}` },
      },
      {
        ...company.common,
        type: "employment",
        id: testDerivedId("employment", id),
        attributes: {
          employeeId: testDerivedId("employee", id),
          status: "ACTIVE",
          employmentType: "FULL_TIME",
        },
      },
    ],
  )
  const reporting: CompanyResourceProps = {
    ...company.common,
    type: "reporting-relation",
    id: "reporting:worker",
    effectiveTo: restoreCalendarDate("2030-07-01"),
    attributes: {
      employeeId: testDerivedId("employee", "worker"),
      managerEmployeeId: testDerivedId("employee", "manager"),
      organizationUnitId: "0190005f-0000-7000-8000-3d39a82ae356",
    },
  }
  const closed: CompanyResourceProps = {
    ...reporting,
    revision: 2,
    state: "void",
    effectiveFrom: restoreCalendarDate("2030-07-01"),
    effectiveTo: null,
  }
  return { ...company, people, reporting, closed, resources: [company.unit, ...people, reporting] }
}
