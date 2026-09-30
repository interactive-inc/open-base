import { ExternalIdentityImportEntity } from "@/contexts/company/domain/entities/external-identity-import.entity"
import { describe, expect, test } from "bun:test"

const identity = {
  subject: "person-1",
  sourceRevision: 1,
  email: "person@example.com",
  name: "Example Person",
  accountId: null,
  initialRoleId: "1f178fc9-9b4d-4247-8dc8-8f1344bf445d",
  newEmployee: { hireDate: "2026-01-01", employmentType: "PART_TIME" },
}
const input = {
  commandId: "directory:1",
  expectedRevision: 0,
  reason: "Confirmed update",
  identities: [identity],
}

describe("ExternalIdentityImportEntity", () => {
  test("同じsubjectや明示Accountを一つのbatchで重ねない", () => {
    expect(
      ExternalIdentityImportEntity.create({ ...input, identities: [identity, identity] }),
    ).toBeInstanceOf(Error)
    expect(
      ExternalIdentityImportEntity.create({
        ...input,
        identities: [
          { ...identity, accountId: "d5858208-e680-4db8-a05d-8bf4f900c24e" },
          { ...identity, subject: "person-2", accountId: "d5858208-e680-4db8-a05d-8bf4f900c24e" },
        ],
      }),
    ).toBeInstanceOf(Error)
  })

  test.each([0, 26])("%s件の入力を拒否する", (count) => {
    expect(
      ExternalIdentityImportEntity.create({
        ...input,
        identities: Array.from({ length: count }, (_, index) => ({
          ...identity,
          subject: `person-${index}`,
        })),
      }),
    ).toBeInstanceOf(Error)
  })

  test.each(["2026-02-29", "2026-13-01", "2026-01-01T00:00:00Z"])(
    "雇用開始日は実在する暦日に限る: %s",
    (hireDate) => {
      expect(
        ExternalIdentityImportEntity.create({
          ...input,
          identities: [{ ...identity, newEmployee: { ...identity.newEmployee, hireDate } }],
        }),
      ).toBeInstanceOf(Error)
    },
  )

  test("fingerprintは操作Accountと外部版を識別する", async () => {
    const command = ExternalIdentityImportEntity.create(input)
    const next = ExternalIdentityImportEntity.create({
      ...input,
      identities: [{ ...identity, sourceRevision: 2 }],
    })
    if (command instanceof Error || next instanceof Error) throw new Error("invalid fixture")
    expect(await command.fingerprint("service-1")).toBe(await command.fingerprint("service-1"))
    expect(await command.fingerprint("service-1")).not.toBe(await command.fingerprint("service-2"))
    expect(await command.fingerprint("service-1")).not.toBe(await next.fingerprint("service-1"))
    expect(Object.isFrozen(command.props.identities[0]?.newEmployee)).toBe(true)
  })
})
