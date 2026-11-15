import { testAccountId } from "@/contexts/system/test/system-test-id.test-support"
import { describe, expect, test } from "bun:test"
import { SystemAuditDisclosurePolicyEntity } from "@system/domain/entities/system-audit-disclosure-policy.entity"
import { auditDisclosureFieldSchema } from "@system/domain/schemas/audit/system-audit-disclosure-policy.schema"
import { SystemAuditDisclosureValue } from "@system/domain/values/audit/system-audit-disclosure.value"
import { SystemAuditDisclosureError } from "@system/domain/errors"

const recordedAt = "2026-01-01T00:00:00.000Z"
const command = {
  scope: "*",
  commandId: "00000000-0000-4000-8000-000000000001",
  expectedRevision: 0,
  enabled: true,
  allowedFields: ["actor_account_id", "metadata_json"],
  allowedTargetTypes: null,
  allowedPurposes: null,
  expiresAt: null,
  reason: "閲覧範囲の設定",
  actorAccountId: "9177c0af-d61f-4e9a-a561-8b2395dfb08d",
}

function policy(overrides: Record<string, unknown> = {}) {
  const { expectedRevision: _expectedRevision, ...props } = command
  const result = SystemAuditDisclosurePolicyEntity.create({
    ...props,
    revision: 1,
    recordedAt,
    auditEventId: "00000000-0000-4000-8000-000000000002",
    ...overrides,
  })
  if (result instanceof Error) throw result
  return result
}

function evaluate(
  policies: ReadonlyArray<SystemAuditDisclosurePolicyEntity>,
  purpose: string | null = null,
  at = new Date(recordedAt),
) {
  return SystemAuditDisclosureValue.evaluate({
    policies,
    accountId: testAccountId("reader"),
    purpose,
    at,
  })
}

function permitted(result: ReturnType<typeof evaluate>) {
  if (result instanceof Error) throw result
  return result
}

describe("System audit disclosure rules", () => {
  test("規則がない読取は既存の項目を保つ", () => {
    const result = permitted(evaluate([]))
    expect(result.fields).toEqual(auditDisclosureFieldSchema.options)
    expect(result.targetTypes).toBeNull()
  })

  test("Accountの設定は全体の開示範囲を広げない", () => {
    const global = policy({ allowedTargetTypes: ["system:account", "system:role"] })
    const reader = policy({
      scope: testAccountId("reader"),
      allowedFields: ["metadata_json", "before_json"],
      allowedTargetTypes: ["system:account", "system:attachment"],
    })
    const result = permitted(evaluate([global, reader]))
    expect(result.fields).toEqual(["metadata_json"])
    expect(result.targetTypes).toEqual(["system:account"])
    expect(permitted(evaluate([reader, global]))).toEqual(result)
  })

  test("空の開示範囲は全件許可へ変換しない", () => {
    const result = permitted(evaluate([policy({ allowedFields: [], allowedTargetTypes: [] })]))
    expect(result.fields).toEqual([])
    expect(result.targetTypes).toEqual([])
  })

  test("目的を制限した規則では省略と不一致を拒否する", () => {
    const rules = [policy({ allowedPurposes: ["review"] })]
    expect(evaluate(rules)).toMatchObject({ kind: "forbidden" })
    expect(evaluate(rules, "export")).toMatchObject({ kind: "forbidden" })
    expect(evaluate(rules, "review")).toBeInstanceOf(SystemAuditDisclosureValue)
    expect(evaluate([policy({ allowedPurposes: [] })], "review")).toMatchObject({
      kind: "forbidden",
    })
  })

  test("有効期限の境界から拒否し無制限へ戻らない", () => {
    const rules = [policy({ expiresAt: "2026-01-02T00:00:00.000Z" })]
    expect(evaluate(rules, null, new Date("2026-01-01T23:59:59.999Z"))).toBeInstanceOf(
      SystemAuditDisclosureValue,
    )
    expect(evaluate(rules, null, new Date("2026-01-02T00:00:00.000Z"))).toMatchObject({
      kind: "forbidden",
    })
    expect(evaluate(rules, null, new Date("2027-01-01T00:00:00.000Z"))).toMatchObject({
      kind: "forbidden",
    })
  })

  test("未来の版は無効化命令でも拒否する", () => {
    expect(
      evaluate([policy({ enabled: false })], null, new Date("2025-12-31T23:59:59.999Z")),
    ).toMatchObject({ kind: "forbidden" })
  })

  test("Account規則の無効化は全体規則を解除しない", () => {
    const result = permitted(
      evaluate([
        policy({ allowedFields: [] }),
        policy({ scope: testAccountId("reader"), enabled: false }),
      ]),
    )
    expect(result.fields).toEqual([])
  })

  test("別Accountまたは同じscopeの複数版は評価不能とする", () => {
    expect(evaluate([policy({ scope: testAccountId("other-reader") })])).toMatchObject({
      kind: "unavailable",
    })
    expect(evaluate([policy(), policy({ revision: 2 })])).toMatchObject({ kind: "unavailable" })
    expect(evaluate([], null, new Date(Number.NaN))).toMatchObject({ kind: "invalid" })
  })

  test("再送は並び順を正規化しつつactorとpayloadの違いを区別する", () => {
    const entity = policy()
    expect(
      entity.matches({
        ...Object.fromEntries(Object.entries(command).reverse()),
        allowedFields: ["metadata_json", "actor_account_id"],
      }),
    ).toBe(true)
    expect(
      entity.matches({ ...command, actorAccountId: "855d97ca-5b8f-4d12-a417-03bfe2bbf4c2" }),
    ).toBe(false)
    expect(entity.matches({ ...command, expectedRevision: 1 })).toBe(false)
    expect(entity.matches({ ...command, enabled: false })).toBe(false)
    expect(entity.matches({ ...command, unrelated: true })).toBe(false)
  })

  test("公開後のsnapshotを配列への参照から変更できない", () => {
    const fields = ["metadata_json"]
    const entity = policy({ allowedFields: fields })
    fields.push("actor_account_id")
    expect(entity.snapshot.allowedFields).toEqual(["metadata_json"])
    expect(Object.isFrozen(entity.snapshot.allowedFields)).toBe(true)
    expect(Object.isFrozen(permitted(evaluate([entity])).fields)).toBe(true)
  })

  test("重複項目と記録以前の有効期限を受け付けない", () => {
    expect(() => policy({ allowedFields: ["metadata_json", "metadata_json"] })).toThrow(
      SystemAuditDisclosureError,
    )
    expect(() => policy({ expiresAt: recordedAt })).toThrow(SystemAuditDisclosureError)
  })
})

function legacyPolicy(overrides: Record<string, unknown> = {}) {
  const result = SystemAuditDisclosurePolicyEntity.restore({
    ...policy().snapshot,
    scope: "legacy-reader",
    actorAccountId: "legacy-admin",
    ...overrides,
  })
  if (result instanceof Error) throw result
  return result
}

test("保存済み識別子の復元は新規命令と新規版のUUID検証を緩めない", () => {
  const stored = legacyPolicy()
  expect(SystemAuditDisclosurePolicyEntity.create(stored.snapshot)).toBeInstanceOf(
    SystemAuditDisclosureError,
  )
  expect(stored.matches(command)).toBe(false)
  expect(stored.snapshot.actorAccountId).toBe("legacy-admin")
  expect(
    SystemAuditDisclosurePolicyEntity.restore({ ...stored.snapshot, allowedFields: ["unknown"] }),
  ).toBeInstanceOf(SystemAuditDisclosureError)
  expect(
    SystemAuditDisclosurePolicyEntity.restore({ ...stored.snapshot, expiresAt: recordedAt }),
  ).toBeInstanceOf(SystemAuditDisclosureError)
})

test("保存済みの別名は信頼できる対応を渡した場合だけ適用する", () => {
  const rules = [legacyPolicy()]
  expect(evaluate(rules)).toMatchObject({ kind: "unavailable" })
  const result = SystemAuditDisclosureValue.evaluate({
    policies: rules,
    accountId: testAccountId("reader"),
    legacyAccountId: "legacy-reader",
    purpose: null,
    at: new Date(recordedAt),
  })
  expect(permitted(result).fields).toEqual(["actor_account_id", "metadata_json"])
})

const retirementIds = {
  commandId: "00000000-0000-4000-8000-000000000005",
  auditEventId: "00000000-0000-4000-8000-000000000006",
}

function replacement(overrides: Record<string, unknown> = {}) {
  return policy({
    scope: testAccountId("reader"),
    supersedesLegacyRevision: 1,
    commandId: "00000000-0000-4000-8000-000000000003",
    auditEventId: "00000000-0000-4000-8000-000000000004",
    ...overrides,
  })
}

test("旧設定の解除は新しい監査記録に結び付け、原文を変更前の記録へ保存する", () => {
  const raw = JSON.stringify(
    Object.fromEntries(Object.entries(legacyPolicy().snapshot).reverse()),
    null,
    2,
  )
  const old = SystemAuditDisclosurePolicyEntity.restoreJson(raw)
  if (old instanceof Error) throw old
  const next = replacement()
  const retired = old.retireInFavorOf(next, retirementIds)
  if (retired instanceof Error) throw retired
  expect(retired.snapshot).toMatchObject({
    scope: "legacy-reader",
    revision: 2,
    enabled: false,
    expiresAt: null,
    actorAccountId: next.snapshot.actorAccountId,
    supersededByAuditEventId: next.snapshot.auditEventId,
  })
  const event = retired.audit(old)
  if (event instanceof Error) throw event
  expect(event.beforeJson).toBe(raw)
  expect(old.snapshot.enabled).toBe(true)
  expect(SystemAuditDisclosurePolicyEntity.restoreJson("{")).toBeInstanceOf(
    SystemAuditDisclosureError,
  )
})

test("違う旧版の指定や全体設定への付替えを拒否する", () => {
  const old = legacyPolicy()
  expect(
    old.retireInFavorOf(replacement({ supersedesLegacyRevision: 2 }), retirementIds),
  ).toBeInstanceOf(SystemAuditDisclosureError)
  expect(old.retireInFavorOf(policy(), retirementIds)).toBeInstanceOf(SystemAuditDisclosureError)
  expect(legacyPolicy({ scope: "*" }).retireInFavorOf(replacement(), retirementIds)).toBeInstanceOf(
    SystemAuditDisclosureError,
  )
  expect(
    old.retireInFavorOf(replacement(), { ...retirementIds, commandId: "invalid" }),
  ).toBeInstanceOf(SystemAuditDisclosureError)
  expect(
    SystemAuditDisclosurePolicyEntity.create({ ...policy().snapshot, supersedesLegacyRevision: 1 }),
  ).toBeInstanceOf(SystemAuditDisclosureError)
})

test("新しい設定の再送では旧版を解除する意思も照合する", () => {
  const next = replacement()
  const input = {
    ...command,
    scope: testAccountId("reader"),
    commandId: next.snapshot.commandId,
    supersedesLegacyRevision: 1,
  }
  expect(next.matches(input)).toBe(true)
  expect(next.matches({ ...input, supersedesLegacyRevision: undefined })).toBe(false)
  expect(next.matches({ ...input, supersedesLegacyRevision: 2 })).toBe(false)
})
