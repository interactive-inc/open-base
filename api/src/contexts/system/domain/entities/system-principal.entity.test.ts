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
        connectorId: "connector:external",
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
})
