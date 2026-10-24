import { expect, test } from "bun:test"
import { EmployeeResourceAdoptionBatchEntity } from "@/contexts/company/domain/entities/employee-resource-adoption-batch.entity"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { CompanyValidationError } from "@/contexts/company/domain/errors"
import type { CompanyResourceProps } from "@/contexts/company/domain/entities/company-resource.entity"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

const input = {
  commandId: "confirmed-batch",
  expectedRevision: 2,
  observedOn: restoreCalendarDate("2026-09-07"),
  reason: "Confirmed history",
  actorAccountId: "9938f3c8-f3b4-4398-b2f6-6553cdee26df",
  recordedAt: Date.parse("2026-09-07T00:00:00Z"),
  employees: [
    { employeeId: "5ee94854-5a8e-4b5a-af95-78411d5f6c82", snapshotDigest: "b".repeat(64) },
    { employeeId: "2f159e48-35a7-479c-97f4-d115a268abfd", snapshotDigest: "a".repeat(64) },
  ],
}

test("呼出元が配列や確認値を変更しても確認対象が変わらず、並び順を固定する", () => {
  const employees = input.employees.map((employee) => ({ ...employee }))
  const command = EmployeeResourceAdoptionBatchEntity.create({ ...input, employees })
  if (command instanceof Error) throw command
  employees[0]!.snapshotDigest = "c".repeat(64)
  employees.length = 0
  expect(command.props.employees).toEqual(input.employees.toReversed())
  expect(Object.isFrozen(command.props.employees)).toBe(true)
  expect(Object.isFrozen(command.props.employees[0])).toBe(true)
})

test("HTTPを通らない呼出しでも重複・不正な確認値・版のoverflow・不正な主体を拒否する", () => {
  for (const change of [
    { employees: [input.employees[0]!, input.employees[0]!] },
    { employees: [] },
    {
      employees: [
        { employeeId: "88ad8bad-6bb3-43c7-8896-631c6d18db36", snapshotDigest: "unconfirmed" },
      ],
    },
    { expectedRevision: Number.MAX_SAFE_INTEGER },
    { expectedRevision: -1 },
    { recordedAt: Number.NaN },
    { actorAccountId: "" },
    { reason: " " },
  ])
    expect(EmployeeResourceAdoptionBatchEntity.create({ ...input, ...change })).toBeInstanceOf(
      CompanyValidationError,
    )
})

test("確認した訂正内容と終了日の補正値を呼出元の変更から保護する", () => {
  const attributes = { officialName: "Confirmed Person" }
  const correction: CompanyResourceProps = {
    organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
    type: "person",
    id: "person:first",
    revision: 2,
    state: "active",
    effectiveFrom: restoreCalendarDate("2020-01-01"),
    effectiveTo: null,
    attributes,
  }
  const termination = { employmentId: "16e506f1-ffee-4605-ace6-534ed0eb4798", endsOn: "2026-08-17" }
  const command = EmployeeResourceAdoptionBatchEntity.create({
    ...input,
    employees: [
      {
        ...input.employees[1]!,
        corrections: [correction],
        terminationBoundaryCorrection: termination,
      },
    ],
  })
  if (command instanceof Error) throw command
  attributes.officialName = "Changed Person"
  termination.endsOn = "2026-09-01"
  expect(command.props.employees[0]?.corrections?.[0]?.attributes["officialName"]).toBe(
    "Confirmed Person",
  )
  expect(command.props.employees[0]?.terminationBoundaryCorrection?.endsOn).toBe("2026-08-17")
  expect(Object.isFrozen(command.props.employees[0]?.corrections?.[0]?.attributes)).toBe(true)
  for (const corrections of [[], Array.from({ length: 21 }, () => correction)])
    expect(
      EmployeeResourceAdoptionBatchEntity.create({
        ...input,
        employees: [{ ...input.employees[1]!, corrections }],
      }),
    ).toBeInstanceOf(CompanyValidationError)
})
