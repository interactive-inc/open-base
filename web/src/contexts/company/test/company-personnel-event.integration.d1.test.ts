import { execSql } from "@system/test/local-d1/exec-sql.test-support"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { expect, setDefaultTimeout, test } from "bun:test"
import { createCompanyAssignmentResourceTestContext } from "@/contexts/company/test/company-assignment-resource.test-support"
import { CompanyPersonnelEventRepository } from "@/contexts/company/infrastructure/repositories/employee-lifecycle/company-personnel-event.repository"
import { CompanyPersonnelEventEntity } from "@/contexts/company/domain/entities/company-personnel-event.entity"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

test("退職日までは在籍し、翌日から雇用終了の効果を解決する", async () => {
  const f = await createCompanyAssignmentResourceTestContext()
  await f.assignEmployeeCode()
  const retired = await f.personnel(
    {
      kind: "retired",
      employeeCode: "EMPLOYEE-001",
      retirementOn: restoreCalendarDate("2030-06-30"),
    },
    "event:retire",
  )
  if (retired instanceof Error) throw retired
  const events = new CompanyPersonnelEventRepository({ env: { DB: f.database } })
  expect(await events.findEmploymentEffect(retired.action.id, "2030-06-30")).toMatchObject({
    status: "future",
    effect: { effectiveOn: "2030-07-01" },
  })
  expect(await events.findEmploymentEffect(retired.action.id, "2030-07-01")).toMatchObject({
    status: "ready",
    effect: { effectiveOn: "2030-07-01" },
  })
})

test("訂正日と訂正後の退職日を区別し、元の発令を配送対象から外す", async () => {
  const f = await createCompanyAssignmentResourceTestContext()
  await f.assignEmployeeCode()
  const retired = await f.personnel(
    {
      kind: "retired",
      employeeCode: "EMPLOYEE-001",
      retirementOn: restoreCalendarDate("2030-06-30"),
    },
    "event:original",
  )
  if (retired instanceof Error) throw retired
  const corrected = await f.personnel(
    {
      kind: "corrected",
      eventOn: restoreCalendarDate("2030-06-01"),
      correctsActionId: retired.action.id,
      reason: "Correct retirement date",
      replacementAction: {
        kind: "retired",
        employeeCode: "EMPLOYEE-001",
        retirementOn: restoreCalendarDate("2030-07-31"),
      },
    },
    "event:correction",
  )
  if (corrected instanceof Error) throw corrected
  expect(corrected.action.summary).toMatchObject({
    eventOn: restoreCalendarDate("2030-06-01"),
    replacementEventOn: "2030-07-31",
  })
  const events = new CompanyPersonnelEventRepository({ env: { DB: f.database } })
  expect(await events.findEmploymentEffect(retired.action.id, "2030-07-01")).toMatchObject({
    status: "superseded",
  })
  expect(await events.findEmploymentEffect(corrected.action.id, "2030-07-01")).toMatchObject({
    status: "future",
    effect: { effectiveOn: "2030-08-01" },
  })
  expect(await events.findEmploymentEffect(corrected.action.id, "2030-08-01")).toMatchObject({
    status: "ready",
  })
})

test("再入社後に古い退職を配送せず、読取後の人事更新で保存全体を取り消す", async () => {
  const f = await createCompanyAssignmentResourceTestContext()
  await f.assignEmployeeCode()
  const retired = await f.personnel(
    {
      kind: "retired",
      employeeCode: "EMPLOYEE-001",
      retirementOn: restoreCalendarDate("2030-06-30"),
    },
    "event:exit",
  )
  if (retired instanceof Error) throw retired
  const events = new CompanyPersonnelEventRepository({ env: { DB: f.database } })
  const snapshot = await events.findEmploymentEffect(retired.action.id, "2030-09-01")
  if (snapshot === null || snapshot instanceof Error) throw new Error("snapshot missing")
  const rehire = await f.personnel(
    {
      kind: "rehire",
      employeeCode: "EMPLOYEE-001",
      eventOn: restoreCalendarDate("2030-09-01"),
      employmentType: "FULL_TIME",
    },
    "event:rehire",
  )
  if (rehire instanceof Error) throw rehire
  expect(await events.findEmploymentEffect(retired.action.id, "2030-09-01")).toMatchObject({
    status: "obsolete",
  })
  expect(await events.findEmploymentEffect(rehire.action.id, "2030-09-01")).toMatchObject({
    status: "ready",
  })
  await execSql(f.database, "CREATE TABLE event_effects (id TEXT PRIMARY KEY)")
  const conflict = await f.database
    .batch([
      f.database.prepare("INSERT INTO event_effects VALUES ('effect')"),
      events.prepareGuard(snapshot),
    ])
    .then(
      () => null,
      (error: unknown) => error,
    )
  expect(conflict).toBeInstanceOf(Error)
  expect(String(conflict)).toContain("company_personnel_event_changed")
  expect(
    await f.database.prepare("SELECT count(*) AS total FROM event_effects").first<number>("total"),
  ).toBe(0)
})

test("発効日の欠けた過去の訂正を、訂正記録日から推測しない", () => {
  const event = CompanyPersonnelEventEntity.create({
    sequence: 1,
    id: "action:correction",
    employeeId: "b4b9edaa-1e08-46d5-b0bc-1798cc369fd1",
    kind: "corrected",
    eventOn: restoreCalendarDate("2030-06-01"),
    recordedAt: 1,
    fingerprint: "a".repeat(64),
    correctsActionId: "action:original",
    correctedByActionId: null,
    summary: {
      kind: "corrected",
      eventOn: restoreCalendarDate("2030-06-01"),
      correctsActionId: "action:original",
      replacementKind: "retired",
    },
  })
  if (event instanceof Error) throw event
  expect(event.employmentEffect()).toBeInstanceOf(Error)
})
