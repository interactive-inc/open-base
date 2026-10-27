import { SystemConnectorEntity } from "@system/domain/entities/system-connector.entity"
import { describe, expect, test } from "bun:test"

const connector = {
  id: "6f1c2a0e-5b7d-4c3a-9e21-8a4d0b6c7e15",
  key: "generic",
  name: "Generic",
  direction: "bidirectional",
  transport: "api",
  status: "active",
  revision: 1,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
} as const

describe("SystemConnectorEntity", () => {
  test("UUIDの主キーと、UUIDではない意味を持つkeyで作成する", () => {
    expect(SystemConnectorEntity.create(connector)).toBeInstanceOf(SystemConnectorEntity)
  })

  test("UUIDではない主キーを拒否する", () => {
    for (const id of [
      "connector:1",
      "6F1C2A0E-5B7D-4C3A-9E21-8A4D0B6C7E15",
      "00000000-0000-0000-0000-000000000000",
      "ffffffff-ffff-ffff-ffff-ffffffffffff",
    ]) {
      expect(SystemConnectorEntity.create({ ...connector, id })).toEqual(
        expect.objectContaining({ reason: "invalid_shape" }),
      )
    }
  })
})
