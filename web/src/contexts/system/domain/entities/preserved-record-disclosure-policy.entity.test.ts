import { PreservedRecordDisclosurePolicyEntity } from "@system/domain/entities/preserved-record-disclosure-policy.entity"
import { expect, test } from "bun:test"

const grant = {
  accountId: "e16b99c2-9319-4546-b0bf-16327ec68ad1",
  actions: ["read"],
  purposes: ["records-review"],
  validFrom: "2026-09-13T01:00:00.000Z",
  validUntil: "2026-09-13T02:00:00.000Z",
}
const input = {
  id: crypto.randomUUID(),
  revision: 1,
  recordId: crypto.randomUUID(),
  status: "active",
  publishedAt: "2026-09-13T00:00:00.000Z",
  actorAccountId: "b3945737-78d1-499f-af4b-6961a126f2fe",
  reason: "Authorized record review",
  auditEventId: crypto.randomUUID(),
  grants: [grant],
}
const request = {
  recordId: input.recordId,
  accountId: "e16b99c2-9319-4546-b0bf-16327ec68ad1",
  action: "read",
  purpose: "records-review",
  at: new Date(grant.validFrom),
}

test("本人・記録・用途・操作が一致する有効期間だけ開示を許す", () => {
  const policy = PreservedRecordDisclosurePolicyEntity.create(input)
  if (policy instanceof Error) throw policy
  expect(policy.permits(request)).toBe(true)
  for (const denied of [
    { ...request, accountId: "98a22f43-e45d-43b9-9095-c0832b6e912b" },
    { ...request, recordId: crypto.randomUUID() },
    { ...request, action: "export" },
    { ...request, purpose: "other-purpose" },
    { ...request, at: new Date("2026-09-13T00:59:59.999Z") },
    { ...request, at: new Date(grant.validUntil) },
    { ...request, at: new Date(Number.NaN) },
  ])
    expect(policy.permits(denied)).toBe(false)
})

test("失効・未公開・候補なしを管理者や設定者の権限で補わない", () => {
  for (const denied of [
    { ...input, status: "revoked" },
    { ...input, publishedAt: "2026-09-14T00:00:00.000Z" },
    { ...input, grants: [] },
  ]) {
    const policy = PreservedRecordDisclosurePolicyEntity.create(denied)
    if (policy instanceof Error) throw policy
    expect(policy.permits(request)).toBe(false)
    expect(policy.permits({ ...request, accountId: input.actorAccountId })).toBe(false)
  }
})

test("矛盾する期間・重複設定を拒否し、作成後の入力変更から設定を隔離する", () => {
  expect(
    PreservedRecordDisclosurePolicyEntity.create({ ...input, grants: [grant, grant] }),
  ).toBeInstanceOf(Error)
  expect(
    PreservedRecordDisclosurePolicyEntity.create({
      ...input,
      grants: [{ ...grant, validUntil: grant.validFrom }],
    }),
  ).toBeInstanceOf(Error)
  const mutableGrant = { ...grant, actions: ["read"], purposes: ["records-review"] }
  const policy = PreservedRecordDisclosurePolicyEntity.create({ ...input, grants: [mutableGrant] })
  if (policy instanceof Error) throw policy
  mutableGrant.actions.push("export")
  mutableGrant.purposes.push("other-purpose")
  expect(policy.permits({ ...request, action: "export" })).toBe(false)
  expect(policy.permits({ ...request, purpose: "other-purpose" })).toBe(false)
  expect(Object.isFrozen(policy.snapshot.grants)).toBe(true)
  expect(Object.isFrozen(policy.snapshot.grants[0]?.actions)).toBe(true)
})
