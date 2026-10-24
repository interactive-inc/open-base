import { DirectPersonnelActionAdapter } from "@/contexts/company/infrastructure/adapters/employee-lifecycle/direct-personnel-action.adapter"
import { EmployeeLifecycleAdapter } from "@/contexts/company/infrastructure/adapters/employee-lifecycle/employee-lifecycle.adapter"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { fingerprintPersonnelAction } from "@/contexts/company/domain/definitions/fingerprint-personnel-action.definition"
import { expect, setDefaultTimeout, test } from "bun:test"
import { createCompanyGradeAssignmentTestContext } from "@/contexts/company/test/company-grade-assignment.test-support"
import { CompanyResourceChangeEntity } from "@/contexts/company/domain/entities/company-resource-change.entity"
import { D1CompanyResourceRepository } from "@/contexts/company/infrastructure/repositories/core/d1-company-resource.repository"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { resolvePersonnelActionInput } from "@/contexts/company/interface/operations/resolve-personnel-action-input"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

test("旧役職台帳の撤去後も確認した会社版と発効日の役職を解決し、改名後の再送で変えない", async () => {
  const f = await createCompanyGradeAssignmentTestContext()
  const repository = new D1CompanyResourceRepository({ database: f.database })
  for (const [index, name, effectiveFrom] of [
    [0, "Coordinator", "2030-01-01"],
    [1, "Lead Coordinator", "2030-07-01"],
  ] as const) {
    const change = CompanyResourceChangeEntity.create({
      commandId: `position:revision:${index}`,
      expectedRevision: await f.companyRevision(),
      actorAccountId: f.creator.accountId,
      reason: "Confirmed position",
      recordedAt: index + 1,
      resources: [
        {
          organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
          type: "position",
          id: "position:coordinator",
          revision: index + 1,
          state: "active",
          effectiveFrom: restoreCalendarDate(effectiveFrom),
          effectiveTo: null,
          attributes: { code: "COORDINATOR", officialName: name, jobId: null },
        },
      ],
    })
    if (change instanceof Error) throw change
    expect(await repository.write(change)).toMatchObject({ kind: "applied" })
  }
  const latest = await f.companyRevision()
  expect(
    await f.database
      .prepare(
        "SELECT count(*) AS count FROM sqlite_master WHERE type = 'table' AND name = 'company_position_definitions'",
      )
      .first<number>("count"),
  ).toBe(0)
  const action = {
    kind: "position_changed" as const,
    employeeCode: "EMPLOYEE-001",
    eventOn: "2030-08-01",
    departmentCode: "TEAM",
    assignmentType: "primary" as const,
    positionCode: "COORDINATOR",
    changeType: "promotion" as const,
  }
  expect(await resolvePersonnelActionInput(f.context, action, latest - 1)).toMatchObject({
    positionTitle: "Coordinator",
    positionReference: {
      resourceId: "position:coordinator",
      resourceRevision: 1,
      organizationRevision: latest - 1,
      effectiveOn: "2030-08-01",
      code: "COORDINATOR",
    },
  })
  expect(await resolvePersonnelActionInput(f.context, action, latest)).toMatchObject({
    positionTitle: "Lead Coordinator",
  })
  expect(
    await resolvePersonnelActionInput(f.context, { ...action, eventOn: "2030-06-01" }, latest),
  ).toMatchObject({ positionTitle: "Coordinator" })
  expect(await resolvePersonnelActionInput(f.context, action, latest - 1)).toMatchObject({
    positionTitle: "Coordinator",
  })
  expect(
    await resolvePersonnelActionInput(f.context, { ...action, positionCode: "MISSING" }, latest),
  ).toBeInstanceOf(Error)
  expect(await resolvePersonnelActionInput(f.context, action, latest + 1)).toBeInstanceOf(Error)
  const sameName = CompanyResourceChangeEntity.create({
    commandId: "position:same-name",
    expectedRevision: latest,
    actorAccountId: f.creator.accountId,
    reason: "Confirm a distinct position with the same display name",
    recordedAt: 3,
    resources: [
      {
        organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
        type: "position",
        id: "position:distinct",
        revision: 1,
        state: "active",
        effectiveFrom: restoreCalendarDate("2030-01-01"),
        effectiveTo: null,
        attributes: { code: "DISTINCT", officialName: "Lead Coordinator", jobId: null },
      },
    ],
  })
  if (sameName instanceof Error) throw sameName
  expect(await repository.write(sameName)).toMatchObject({ kind: "applied" })
  const first = await resolvePersonnelActionInput(f.context, action, latest + 1)
  const second = await resolvePersonnelActionInput(
    f.context,
    { ...action, positionCode: "DISTINCT" },
    latest + 1,
  )
  if (first instanceof Error) throw first
  if (second instanceof Error) throw second
  expect(first).toMatchObject({ positionTitle: "Lead Coordinator" })
  expect(second).toMatchObject({ positionTitle: "Lead Coordinator" })
  expect(await fingerprintPersonnelAction(f.people[0]!.employeeId, first, latest + 1)).not.toBe(
    await fingerprintPersonnelAction(f.people[0]!.employeeId, second, latest + 1),
  )
  if (first.kind !== "position_changed" || first.positionReference === undefined)
    throw new Error("Position reference missing")
  const employeeId = f.people[0]!.employeeId
  const revisions = await new EmployeeLifecycleAdapter(f.context).loadRevisions(employeeId)
  if (revisions instanceof Error) throw revisions
  const command = {
    session: {
      accountId: zAccountId.parse(f.creator.accountId),
      employeeId,
      hasPermission: () => true,
    },
    employeeId,
    input: first,
    idempotencyKey: "position:confirmed-execution",
    expectedCompanyRevision: latest + 1,
    expectedEmployeeRevision: revisions.employeeRevision,
    expectedOrganizationRevision: revisions.organizationRevision,
  }
  const adapter = new DirectPersonnelActionAdapter(f.context)
  const before = await f.persisted()
  for (const changed of [
    { ...first, positionTitle: "Forged name" },
    { ...first, positionReference: { ...first.positionReference, resourceId: "position:missing" } },
    { ...first, positionReference: { ...first.positionReference, resourceRevision: 1 } },
    { ...first, positionReference: { ...first.positionReference, code: "DISTINCT" } },
    { ...first, positionReference: { ...first.positionReference, organizationRevision: latest } },
    { ...first, positionReference: { ...first.positionReference, effectiveOn: "2030-06-01" } },
  ]) {
    expect(await adapter.apply({ ...command, input: changed })).toMatchObject({
      code: "invalid_change",
    })
    expect(await f.persisted()).toEqual(before)
  }
  const applied = await adapter.apply(command)
  if (applied instanceof Error) throw applied
  expect(applied.replayed).toBe(false)
  expect(await adapter.apply(command)).toMatchObject({ replayed: true })
  const audit = await f.database
    .prepare(
      "SELECT metadata_json FROM system_audit_events WHERE json_extract(metadata_json, '$.positionReference.resourceId') = ? AND action = 'employee.lifecycle.applied'",
    )
    .bind(first.positionReference.resourceId)
    .first<{ metadata_json: string }>()
  expect(JSON.parse(audit?.metadata_json ?? "null")).toMatchObject({
    positionReference: first.positionReference,
  })
})
