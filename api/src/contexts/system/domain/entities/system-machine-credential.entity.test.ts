import { SystemMachineCredentialEntity } from "@system/domain/entities/system-machine-credential.entity"
import { describe, expect, test } from "bun:test"

const createdAt = new Date("2026-08-31T00:00:00.000Z")
const usedAt = new Date("2026-08-31T00:01:00.000Z")

function createCredential(): SystemMachineCredentialEntity {
  const credential = SystemMachineCredentialEntity.create({
    id: "credential:1",
    principalId: "706562a0-8521-4b2d-81db-70207dd894b4",
    name: "automation",
    secretHash: "a".repeat(64),
    status: "active",
    createdAt,
    updatedAt: createdAt,
    expiresAt: new Date("2026-09-01T00:00:00.000Z"),
    lastUsedAt: null,
    revokedAt: null,
  })
  if (credential instanceof Error) throw credential

  return credential
}

describe("SystemMachineCredentialEntity", () => {
  test("利用時刻と失効を単調なcredential lifecycleとして記録する", () => {
    const credential = createCredential()
    const used = credential.recordUse(usedAt)
    if (used instanceof Error) throw used
    const revoked = used.revoke(new Date("2026-08-31T00:02:00.000Z"))
    if (revoked instanceof Error) throw revoked

    expect(used.lastUsedAt).toEqual(usedAt)
    expect(revoked.status).toBe("revoked")
    expect(revoked.isUsableAt(new Date("2026-08-31T00:03:00.000Z"))).toBeFalse()
  })

  test("期限切れと時刻逆行を拒否する", () => {
    const credential = createCredential()

    expect(credential.isUsableAt(new Date("2026-09-01T00:00:00.000Z"))).toBeFalse()
    expect(credential.recordUse(new Date("2026-08-30T23:59:59.000Z"))).toEqual(
      expect.objectContaining({ reason: "invalid_transition" }),
    )
  })
})
