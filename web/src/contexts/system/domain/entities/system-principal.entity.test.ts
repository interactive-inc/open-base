import { testDerivedId } from "@system/test/system-test-id.test-support"
import { SystemPrincipalEntity } from "@system/domain/entities/system-principal.entity"
import { describe, expect, test } from "bun:test"

const now = new Date("2026-08-31T00:00:00.000Z")

describe("SystemPrincipalEntity", () => {
  test("Human・Agent・Service・ConnectorをAccountから独立した主体種別として復元する", () => {
    for (const kind of ["human", "agent", "service"] as const) {
      expect(
        SystemPrincipalEntity.create({
          id: testDerivedId("principal", kind),
          accountId: testDerivedId("account", kind),
          kind,
          name: kind,
          connectorId: null,
          revision: 1,
          createdAt: now,
          updatedAt: now,
        }),
      ).toBeInstanceOf(SystemPrincipalEntity)
    }
    expect(
      SystemPrincipalEntity.create({
        id: "principal:connector",
        accountId: "4e1ad874-b77a-4853-b6ea-e3f9bad3df21",
        kind: "connector",
        name: "Connector",
        connectorId: "6f1c2a0e-5b7d-4c3a-9e21-8a4d0b6c7e15",
        revision: 1,
        createdAt: now,
        updatedAt: now,
      }),
    ).toBeInstanceOf(SystemPrincipalEntity)
  })

  test("ConnectorだけにConnector参照を要求する", () => {
    expect(
      SystemPrincipalEntity.create({
        id: "principal:connector",
        accountId: "4e1ad874-b77a-4853-b6ea-e3f9bad3df21",
        kind: "connector",
        name: "Connector",
        connectorId: null,
        revision: 1,
        createdAt: now,
        updatedAt: now,
      }),
    ).toEqual(expect.objectContaining({ reason: "invalid_subject" }))
  })

  test("UUIDではないConnector参照を拒否する", () => {
    for (const connectorId of [
      "connector:external",
      "6F1C2A0E-5B7D-4C3A-9E21-8A4D0B6C7E15",
      "00000000-0000-0000-0000-000000000000",
      "ffffffff-ffff-ffff-ffff-ffffffffffff",
    ]) {
      expect(
        SystemPrincipalEntity.create({
          id: "principal:connector",
          accountId: "4e1ad874-b77a-4853-b6ea-e3f9bad3df21",
          kind: "connector",
          name: "Connector",
          connectorId,
          revision: 1,
          createdAt: now,
          updatedAt: now,
        }),
      ).toEqual(expect.objectContaining({ reason: "invalid_shape" }))
    }
  })
})
