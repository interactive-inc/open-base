import { describe, expect, test } from "bun:test"
import { AuditCursor } from "@/contexts/company/domain/definitions/audit-cursor.definition"
import type { AuditCursorPosition } from "@/contexts/company/domain/definitions/audit-cursor.definition"
import { CompanyValidationError } from "@/contexts/company/domain/errors"

function encodeRawJson(json: string): string {
  const bytes = new TextEncoder().encode(json)
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)

  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "")
}

function position(overrides: Partial<AuditCursorPosition> = {}): AuditCursorPosition {
  return {
    version: 2,
    direction: "next",
    snapshotMaxId: 400,
    limit: 100,
    filterFingerprint: "A".repeat(22),
    sourceFirst: [100, 400],
    sourceLast: [100, -7],
    sourceHasPrevious: false,
    sourceHasNext: true,
    targetFirst: null,
    targetLast: null,
    targetHasPrevious: null,
    targetHasNext: null,
    ...overrides,
  }
}

describe("audit cursor", () => {
  test("round-trips the bounded v2 snapshot and source/target page ranges", () => {
    const value = position({
      direction: "previous",
      sourceFirst: [100, 380],
      sourceLast: [100, 361],
      sourceHasPrevious: true,
      sourceHasNext: true,
      targetFirst: [100, 400],
      targetLast: [100, 381],
      targetHasPrevious: false,
      targetHasNext: true,
    })

    const token = AuditCursor.encode(value)

    expect(token.length).toBeLessThanOrEqual(AuditCursor.MAX_LENGTH)
    expect(AuditCursor.decode(token)).toEqual(value)
  })

  test("keeps worst-case safe signed anchors inside the cursor cap", () => {
    const maxEpochSeconds = 8_640_000_000_000
    const minEpochSeconds = -8_640_000_000_000
    const token = AuditCursor.encode(
      position({
        snapshotMaxId: Number.MAX_SAFE_INTEGER,
        sourceFirst: [maxEpochSeconds, Number.MAX_SAFE_INTEGER],
        sourceLast: [minEpochSeconds, Number.MIN_SAFE_INTEGER],
        targetFirst: [maxEpochSeconds, Number.MIN_SAFE_INTEGER],
        targetLast: [minEpochSeconds, Number.MAX_SAFE_INTEGER],
        targetHasPrevious: true,
        targetHasNext: true,
      }),
    )

    expect(token.length).toBeLessThanOrEqual(AuditCursor.MAX_LENGTH)
    expect(AuditCursor.decode(token).sourceLast[1]).toBe(Number.MIN_SAFE_INTEGER)
  })

  test("rejects reversed ranges, anchors beyond the snapshot, and unavailable directions", () => {
    expect(() =>
      AuditCursor.encode(position({ sourceFirst: [99, 1], sourceLast: [100, 1] })),
    ).toThrow(CompanyValidationError)
    expect(() => AuditCursor.encode(position({ sourceFirst: [100, 401] }))).toThrow(
      CompanyValidationError,
    )
    expect(() => AuditCursor.encode(position({ sourceHasNext: false }))).toThrow(
      CompanyValidationError,
    )
  })

  test.each(["not+base64url", "eyJ2ZXJzaW9uIjoyfQ==", "a".repeat(257), "bm90LWpzb24", "_w"])(
    "rejects malformed token %s with the stable cursor error",
    (token) => {
      try {
        AuditCursor.decode(token)
        throw new Error("expected cursor rejection")
      } catch (error) {
        expect(error).toBeInstanceOf(CompanyValidationError)
        expect((error as CompanyValidationError).code).toBe("invalid_audit_cursor")
        expect((error as CompanyValidationError).message).toBe("audit cursor is invalid")
      }
    },
  )

  test.each([
    [
      '[1,"n","b4",100,"AAAAAAAAAAAAAAAAAAAAAA","2s","b4","2s","1",2,null,null,null,null,null]',
      "unsupported version",
    ],
    [
      '[2,"x","b4",100,"AAAAAAAAAAAAAAAAAAAAAA","2s","b4","2s","1",2,null,null,null,null,null]',
      "unknown direction",
    ],
    ['[2,"n","b4",100,"short","2s","b4","2s","1",2,null,null,null,null,null]', "short fingerprint"],
    [
      '[2,"n","b4",100,"AAAAAAAAAAAAAAAAAAAAAA","2s","b4","2s","1",4,null,null,null,null,null]',
      "invalid flags",
    ],
    [
      '[2,"n","b4",100,"AAAAAAAAAAAAAAAAAAAAAA","02s","b4","2s","1",2,null,null,null,null,null]',
      "noncanonical integer",
    ],
    [
      '[2,"n","b4",100,"AAAAAAAAAAAAAAAAAAAAAA","2s","b4","2s","1",2,"2s",null,"2s","1",2]',
      "partial target",
    ],
    [
      '[2,"n","b4",100,"AAAAAAAAAAAAAAAAAAAAAA","2s","b4","2s","1",2,null,null,null,null,null,"extra"]',
      "extra item",
    ],
    ['{"version":2}', "object payload"],
  ])("rejects a decoded payload with %s", (json) => {
    expect(() => AuditCursor.decode(encodeRawJson(json))).toThrow(CompanyValidationError)
  })

  test("rejects noncanonical JSON whitespace", () => {
    const canonical = AuditCursor.encode(position())
    const decodedJson = new TextDecoder().decode(
      Uint8Array.from(
        atob(canonical.replaceAll("-", "+").replaceAll("_", "/") + "=="),
        (character) => character.charCodeAt(0),
      ),
    )

    expect(() => AuditCursor.decode(encodeRawJson(` ${decodedJson}`))).toThrow(
      CompanyValidationError,
    )
  })

  test("accepts next and previous as the two directions", () => {
    for (const direction of ["next", "previous"] as const) {
      const value = position({ direction, sourceHasPrevious: direction === "previous" })
      expect(AuditCursor.decode(AuditCursor.encode(value))).toEqual(value)
    }
  })

  test("accepts a position change when the unsigned cursor is correctly re-encoded", () => {
    const original = AuditCursor.encode(position())
    const changed = AuditCursor.encode({
      ...AuditCursor.decode(original),
      snapshotMaxId: 401,
      sourceFirst: [101, 401],
    })

    expect(AuditCursor.decode(changed).sourceFirst).toEqual([101, 401])
  })
})
