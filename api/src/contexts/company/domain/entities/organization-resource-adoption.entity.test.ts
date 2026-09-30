import { expect, test } from "bun:test"
import { OrganizationResourceAdoptionEntity } from "@/contexts/company/domain/entities/organization-resource-adoption.entity"
import type { OrganizationResourceAdoptionInput } from "@/contexts/company/domain/entities/organization-resource-adoption.entity"
import { OrganizationResourceAdoptionSnapshotValue } from "@/contexts/company/domain/values/organization-resource-adoption-snapshot.value"
import { CompanyValidationError } from "@/contexts/company/domain/errors"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { deterministicCompanyId } from "@/contexts/company/domain/definitions/deterministic-company-id.definition"
import { companyOperationId } from "@/contexts/company/domain/definitions/company-operation-id.definition"
import { COMPANY_ROOT_ORGANIZATION_UNIT_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

async function adopt(
  isInitialization: boolean,
  initializationConfirmation?: OrganizationResourceAdoptionInput["initializationConfirmation"],
  initializationActionId = "initialization:organization:default",
) {
  const snapshot = await OrganizationResourceAdoptionSnapshotValue.create(
    JSON.stringify({
      organizationRevision: 1,
      lifecycleRevision: 1,
      pendingOperations: 0,
      organizationUnit: { id: COMPANY_ROOT_ORGANIZATION_UNIT_ID, createdAt: 0 },
      bindingOrganizationId: null,
      periods: [
        {
          periodId: deterministicCompanyId("initial-period", "company:root:initial"),
          revision: 1,
          organizationUnitId: COMPANY_ROOT_ORGANIZATION_UNIT_ID,
          code: "COMPANY",
          officialName: "Company",
          kind: "COMPANY",
          parentOrganizationUnitId: null,
          startsOn: "1970-01-01",
          endsOn: null,
          isVoid: 0,
          recordedByActionId: isInitialization
            ? companyOperationId(initializationActionId)
            : "verified:1",
          recordedAt: isInitialization ? 0 : 1,
          actorAccountId: isInitialization
            ? "system:initialization"
            : "a63d1b89-54f5-4001-8ed7-f2077c91340d",
          reason: isInitialization ? "Initialize organization root" : "Confirmed original record",
          evidenceReferencesJson: "[]",
          requestFingerprint: "0".repeat(64),
        },
      ],
    }),
  )
  if (snapshot instanceof Error) throw snapshot
  const command = OrganizationResourceAdoptionEntity.create({
    commandId: "adoption:1",
    organizationUnitId: COMPANY_ROOT_ORGANIZATION_UNIT_ID,
    expectedRevision: 1,
    snapshotDigest: snapshot.props.digest,
    observedOn: "2026-09-13",
    reason: "Preserve confirmed history",
    actorAccountId: "a63d1b89-54f5-4001-8ed7-f2077c91340d",
    recordedAt: Date.parse("2026-09-13T00:00:00Z"),
    initializationConfirmation,
  })
  if (command instanceof Error) throw command
  return command.toChanges(snapshot)
}

test("旧初期データの仮期間を会社の確定履歴へ昇格させない", async () => {
  const changes = await adopt(true)
  expect(changes).toBeInstanceOf(CompanyValidationError)
  expect(changes).toMatchObject({ code: "organization_history_confirmation_required" })
})

test("1970年という日付だけで確認済みの履歴を拒否しない", async () => {
  const changes = await adopt(false)
  expect(changes).not.toBeInstanceOf(Error)
  if (changes instanceof Error) throw changes
  expect(changes).toHaveLength(1)
  expect(changes[0]?.resources[0]?.effectiveFrom).toBe(restoreCalendarDate("1970-01-01"))
})

test("確認日より未来の期間や通常履歴への初期確認の流用を拒否する", async () => {
  const evidenceReferences = [{ context: "company", kind: "record", id: "record:1", version: "1" }]
  expect(await adopt(true, { startsOn: "2026-09-14", evidenceReferences })).toBeInstanceOf(
    CompanyValidationError,
  )
  expect(await adopt(false, { startsOn: "2020-01-01", evidenceReferences })).toBeInstanceOf(
    CompanyValidationError,
  )
})

test("初期期間の確認には少なくとも一つの版付き根拠を要求する", async () => {
  const rejected = await adopt(true, { startsOn: "2020-01-01", evidenceReferences: [] }).catch(
    (cause: unknown) => cause,
  )
  expect(rejected).toBeInstanceOf(CompanyValidationError)
})

test.each(["initialization:organization:default", "initialization:company:root"])(
  "%sの仮期間を識別し、確認した期間だけを同じ会社版へ採用する",
  async (operationId) => {
    expect(await adopt(true, undefined, operationId)).toBeInstanceOf(CompanyValidationError)
    const changes = await adopt(
      true,
      {
        startsOn: "2020-01-01",
        evidenceReferences: [{ context: "company", kind: "record", id: "record:1", version: "1" }],
      },
      operationId,
    )
    if (changes instanceof Error) throw changes
    expect(changes).toHaveLength(1)
    expect(changes[0]?.resources).toMatchObject([
      { revision: 1, state: "void", effectiveFrom: "1970-01-01" },
      { revision: 2, state: "active", effectiveFrom: "2020-01-01" },
    ])
  },
)
