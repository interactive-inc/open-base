import { execSql } from "@system/test/local-d1/exec-sql.test-support"
import { CompanyActorValue } from "@/contexts/company/domain/values/company-actor.value"
import { D1CompanyResourceRepository } from "@/contexts/company/infrastructure/repositories/core/d1-company-resource.repository"
import { expect, setDefaultTimeout, test } from "bun:test"
import { createCompanyGradeAssignmentTestContext } from "@/contexts/company/test/company-grade-assignment.test-support"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

test("等級定義と雇用への割当を一緒に保存し、将来の昇格・過去参照・再送を保つ", async () => {
  const f = await createCompanyGradeAssignmentTestContext()
  expect(await f.read("2030-02-28")).toEqual([])
  expect((await f.read("2030-03-01"))[0]?.attributes.gradeId).toBe(f.grade.id)
  const nextGrade = {
    ...f.grade,
    id: "grade:second",
    attributes: { ...f.grade.attributes, code: "G2", rank: 2 },
  }
  const nextAssignment = {
    ...f.appointment,
    revision: 2,
    effectiveFrom: "2030-09-01",
    attributes: { ...f.appointment.attributes, gradeId: nextGrade.id },
  }
  expect(
    Number(
      (await f.write([nextAssignment, nextGrade], await f.companyRevision(), "grade:promotion"))
        .status,
    ),
  ).toBe(201)
  expect((await f.read("2030-08-31"))[0]?.attributes.gradeId).toBe(f.grade.id)
  expect((await f.read("2030-09-01"))[0]?.attributes.gradeId).toBe(nextGrade.id)
  const before = await f.persisted()
  expect(
    Number((await f.write([f.appointment, f.grade], f.expectedRevision, "grade:initial")).status),
  ).toBe(200)
  expect(await f.persisted()).toEqual(before)
})

test("等級の欠落、別人への付替え、期間の重複と参照期間の切断を全体拒否する", async () => {
  const f = await createCompanyGradeAssignmentTestContext()
  const before = await f.persisted()
  for (const resource of [
    {
      ...f.appointment,
      id: "grade-assignment:missing",
      attributes: { ...f.appointment.attributes, gradeId: "grade:missing" },
    },
    {
      ...f.appointment,
      revision: 2,
      attributes: {
        ...f.appointment.attributes,
        employeeId: "ebb00dc2-45bc-4fd0-b048-dff5f3438a41",
      },
    },
    {
      ...f.appointment,
      id: "grade-assignment:foreign-employment",
      attributes: { ...f.appointment.attributes, employeeId: f.people[1]!.employeeId },
    },
    { ...f.appointment, id: "grade-assignment:duplicate" },
    { ...f.grade, revision: 2, effectiveTo: "2030-08-01" },
  ]) {
    expect(
      Number(
        (await f.write([resource], await f.companyRevision(), `invalid:${resource.id}`)).status,
      ),
    ).toBe(422)
    expect(await f.persisted()).toEqual(before)
  }
})

test("退職は等級割当を閉じ、退職日の訂正でも過去を保ち、再入社で復活させない", async () => {
  const f = await createCompanyGradeAssignmentTestContext()
  const retired = await f.personnel(
    {
      kind: "retired",
      employeeCode: "EMPLOYEE-001",
      retirementOn: restoreCalendarDate("2030-06-30"),
    },
    "grade:retire",
  )
  if (retired instanceof Error) throw retired
  expect(await f.read("2030-06-30")).toHaveLength(1)
  expect(await f.read("2030-07-01")).toEqual([])
  const corrected = await f.personnel(
    {
      kind: "corrected",
      correctsActionId: retired.action.id,
      eventOn: restoreCalendarDate("2030-06-01"),
      reason: "Confirmed retirement correction",
      replacementAction: {
        kind: "retired",
        employeeCode: "EMPLOYEE-001",
        retirementOn: restoreCalendarDate("2030-07-31"),
      },
    },
    "grade:correct",
  )
  if (corrected instanceof Error) throw corrected
  expect(await f.read("2030-07-31")).toHaveLength(1)
  expect(await f.read("2030-08-01")).toEqual([])
  const rehired = await f.personnel(
    {
      kind: "rehire",
      employeeCode: "EMPLOYEE-001",
      eventOn: restoreCalendarDate("2030-09-01"),
      employmentType: "FULL_TIME",
    },
    "grade:rehire",
  )
  if (rehired instanceof Error) throw rehired
  expect(await f.read("2030-09-01")).toEqual([])
})

test("公開履歴の保存失敗で等級変更を取り消し、同じ依頼を再試行できる", async () => {
  const f = await createCompanyGradeAssignmentTestContext()
  const before = await f.persisted()
  const resources = [{ ...f.appointment, revision: 2, effectiveTo: "2030-08-01" }]
  const revision = await f.companyRevision()
  await execSql(
    f.database,
    "CREATE TRIGGER reject_grade_change BEFORE INSERT ON company_resource_revisions WHEN NEW.resource_type = 'grade-assignment' BEGIN SELECT RAISE(ABORT, 'storage unavailable'); END;",
  )
  expect(Number((await f.write(resources, revision, "grade:retry")).status)).toBe(503)
  expect(await f.persisted()).toEqual(before)
  await execSql(f.database, "DROP TRIGGER reject_grade_change")
  expect(Number((await f.write(resources, revision, "grade:retry")).status)).toBe(201)
  expect(await f.read("2030-08-01")).toEqual([])
})

test("将来の等級定義の改名でも割当期間を保ち、終了と後続割当を一つの会社版で変更する", async () => {
  const f = await createCompanyGradeAssignmentTestContext()
  const changedGrade = {
    ...f.grade,
    revision: 2,
    effectiveFrom: "2030-08-01",
    attributes: {
      ...f.grade.attributes,
      officialName: "Renamed Grade",
      description: null,
      rank: null,
    },
  }
  expect(
    Number((await f.write([changedGrade], await f.companyRevision(), "grade:rename")).status),
  ).toBe(201)
  const repository = new D1CompanyResourceRepository({ database: f.database })
  const past = await repository.findMany({
    organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
    types: ["grade"],
    effectiveOn: restoreCalendarDate("2030-07-31"),
  })
  if (!past.ok) throw past.cause
  expect(past.resources[0]?.attributes).toEqual(f.grade.attributes)
  const current = await repository.findMany({
    organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
    types: ["grade"],
    effectiveOn: restoreCalendarDate("2030-08-01"),
  })
  if (!current.ok) throw current.cause
  expect(current.resources[0]?.attributes).toEqual(changedGrade.attributes)
  const next = { ...f.appointment, id: "grade-assignment:next", effectiveFrom: "2030-09-01" }
  const ended = { ...f.appointment, revision: 2, effectiveTo: "2030-09-01" }
  expect(
    Number((await f.write([next, ended], await f.companyRevision(), "grade:handover")).status),
  ).toBe(201)
  expect((await f.read("2030-08-31")).map((resource) => resource.id)).toEqual([f.appointment.id])
  expect((await f.read("2030-09-01")).map((resource) => resource.id)).toEqual([next.id])
})

test("同時更新を一つだけ確定し、会社範囲外からは成功済み再送も拒否する", async () => {
  const f = await createCompanyGradeAssignmentTestContext()
  const revision = await f.companyRevision()
  const resources = [{ ...f.appointment, revision: 2, effectiveTo: "2030-10-01" }]
  const responses = await Promise.all([
    f.write(resources, revision, "grade:race-a"),
    f.write(resources, revision, "grade:race-b"),
  ])
  expect(
    responses.map((response) => Number(response.status)).toSorted((left, right) => left - right),
  ).toEqual([201, 409])
  const before = await f.persisted()
  f.setActor(
    CompanyActorValue.restore({
      ...f.creator,
      organizationIds: ["01900060-0000-7000-8000-12268fccf2cc"],
      capabilities: ["company:admin"],
    }),
  )
  expect(
    Number((await f.write([f.appointment, f.grade], f.expectedRevision, "grade:initial")).status),
  ).toBe(403)
  expect(await f.persisted()).toEqual(before)
})

test("将来の昇格予約を退職後に残さず、退職訂正では確認済みの昇格履歴を保つ", async () => {
  const f = await createCompanyGradeAssignmentTestContext()
  const grade = {
    ...f.grade,
    id: "grade:future",
    attributes: { ...f.grade.attributes, code: "G2", rank: 2 },
  }
  const promotion = {
    ...f.appointment,
    revision: 2,
    effectiveFrom: "2030-09-01",
    attributes: { ...f.appointment.attributes, gradeId: grade.id },
  }
  expect(
    Number((await f.write([grade, promotion], await f.companyRevision(), "grade:future")).status),
  ).toBe(201)
  const beforeRevision = await f.companyRevision()
  const retired = await f.personnel(
    {
      kind: "retired",
      employeeCode: "EMPLOYEE-001",
      retirementOn: restoreCalendarDate("2030-06-30"),
    },
    "grade:future-retire",
  )
  if (retired instanceof Error) throw retired
  expect(await f.companyRevision()).toBe(beforeRevision + 1)
  expect(await f.read("2030-09-01")).toEqual([])
  const corrected = await f.personnel(
    {
      kind: "corrected",
      correctsActionId: retired.action.id,
      eventOn: restoreCalendarDate("2030-06-01"),
      reason: "Confirm later retirement",
      replacementAction: {
        kind: "retired",
        employeeCode: "EMPLOYEE-001",
        retirementOn: restoreCalendarDate("2030-10-31"),
      },
    },
    "grade:future-correct",
  )
  if (corrected instanceof Error) throw corrected
  expect((await f.read("2030-08-31"))[0]?.attributes.gradeId).toBe(f.grade.id)
  expect((await f.read("2030-09-01"))[0]?.attributes.gradeId).toBe(grade.id)
  expect(await f.read("2030-11-01")).toEqual([])
})
