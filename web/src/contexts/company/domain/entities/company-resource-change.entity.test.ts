import { describe, expect, test } from "bun:test"
import { CompanyResourceChangeEntity } from "@/contexts/company/domain/entities/company-resource-change.entity"
import type { CompanyResourceProps } from "@/contexts/company/domain/entities/company-resource.entity"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

const employee = {
  organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
  type: "employee",
  id: "employee:1",
  revision: 1,
  state: "active",
  effectiveFrom: restoreCalendarDate("2026-01-01"),
  effectiveTo: null,
  attributes: { personId: "person:1" },
} as const satisfies CompanyResourceProps

describe("CompanyResourceChangeEntity", () => {
  test("一command内の同一resource重複を拒否する", () => {
    expect(
      CompanyResourceChangeEntity.create({
        commandId: "command:1",
        expectedRevision: 0,
        actorAccountId: "c0975461-26d2-43a1-86d2-124bd000d9c9",
        reason: "initial import",
        recordedAt: 1,
        resources: [employee, employee],
      }),
    ).toEqual(expect.objectContaining({ code: "invalid_change" }))
  })

  test("検証済みresourceだけをdeep freezeして保持する", () => {
    const change = CompanyResourceChangeEntity.create({
      commandId: "command:1",
      expectedRevision: 0,
      actorAccountId: "c0975461-26d2-43a1-86d2-124bd000d9c9",
      reason: "initial import",
      recordedAt: 1,
      resources: [employee],
    })
    expect(change).toBeInstanceOf(CompanyResourceChangeEntity)
    if (!(change instanceof CompanyResourceChangeEntity)) return
    expect(Object.isFrozen(change)).toBeTrue()
    expect(Object.isFrozen(change.resources)).toBeTrue()
  })

  test("原資料参照を検証して不変の変更記録に保持する", () => {
    const reference = { context: "system", kind: "document", id: "hire:1", version: "2" }
    const change = CompanyResourceChangeEntity.create({
      commandId: "command:evidence",
      expectedRevision: 0,
      actorAccountId: "c0975461-26d2-43a1-86d2-124bd000d9c9",
      reason: "corrected from original document",
      recordedAt: 1,
      evidenceReferences: [reference],
      resources: [employee],
    })
    expect(change).toBeInstanceOf(CompanyResourceChangeEntity)
    if (!(change instanceof CompanyResourceChangeEntity)) return
    expect(change.evidenceReferences).toEqual([reference])
    expect(Object.isFrozen(change.evidenceReferences[0])).toBeTrue()
    expect(
      CompanyResourceChangeEntity.create({
        commandId: "command:invalid-evidence",
        expectedRevision: 0,
        actorAccountId: "c0975461-26d2-43a1-86d2-124bd000d9c9",
        reason: "invalid evidence",
        recordedAt: 1,
        evidenceReferences: [{ ...reference, id: " hire:1" }],
        resources: [employee],
      }),
    ).toMatchObject({ code: "invalid_change" })
  })

  test("訂正元revisionは同一command内の対象資源と原資料に結び付ける", () => {
    const props = {
      commandId: "command:correction",
      expectedRevision: 1,
      actorAccountId: "c0975461-26d2-43a1-86d2-124bd000d9c9",
      reason: "correct old employee fact",
      recordedAt: 2,
      resources: [{ ...employee, revision: 2 }],
      corrections: [
        { type: "employee" as const, id: employee.id, revision: 2, correctsRevision: 1 },
      ],
    }
    expect(CompanyResourceChangeEntity.create(props)).toMatchObject({ code: "invalid_change" })
    const withEvidence = {
      ...props,
      evidenceReferences: [{ context: "system", kind: "document", id: "hire:1", version: "1" }],
    }
    const change = CompanyResourceChangeEntity.create(withEvidence)
    expect(change).toBeInstanceOf(CompanyResourceChangeEntity)
    if (!(change instanceof CompanyResourceChangeEntity)) return
    expect(change.corrections).toEqual(props.corrections)
    expect(Object.isFrozen(change.corrections[0])).toBeTrue()
    for (const corrections of [
      [{ ...props.corrections[0]!, id: "employee:other" }],
      [{ ...props.corrections[0]!, correctsRevision: 2 }],
      [props.corrections[0]!, props.corrections[0]!],
    ]) {
      expect(CompanyResourceChangeEntity.create({ ...withEvidence, corrections })).toMatchObject({
        code: "invalid_change",
      })
    }
  })
})

test("人事履歴の内部batchは同じ資源の連続版を受け付け、通常commandは重複を拒否する", () => {
  const props = {
    commandId: "command:history",
    expectedRevision: 1,
    actorAccountId: "c0975461-26d2-43a1-86d2-124bd000d9c9",
    reason: "confirmed personnel history",
    recordedAt: 2,
    resources: [employee, { ...employee, revision: 2 }],
  }
  expect(CompanyResourceChangeEntity.create(props)).toMatchObject({ code: "invalid_change" })
  expect(CompanyResourceChangeEntity.createHistoryBatch(props)).toBeInstanceOf(
    CompanyResourceChangeEntity,
  )
  for (const revisions of [
    [1, 1],
    [1, 3],
    [2, 1],
  ]) {
    expect(
      CompanyResourceChangeEntity.createHistoryBatch({
        ...props,
        resources: revisions.map((revision) => ({ ...employee, revision })),
      }),
    ).toMatchObject({ code: "invalid_change" })
  }
})
