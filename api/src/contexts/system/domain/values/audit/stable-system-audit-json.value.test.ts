import { describe, expect, test } from "bun:test"
import { SystemAuditJsonError } from "@system/domain/errors"
import type { SystemAuditJsonValue } from "@system/domain/definitions/audit/system-audit-json-value.definition"
import { StableSystemAuditJsonValue } from "@system/domain/values/audit/stable-system-audit-json.value"

function serializeStableSystemAuditJson(
  value: SystemAuditJsonValue,
): string | null | SystemAuditJsonError {
  const serialized = StableSystemAuditJsonValue.create(value)
  return serialized instanceof StableSystemAuditJsonValue ? serialized.toString() : serialized
}

function expectInvalidJson(value: unknown): void {
  const serialized = Reflect.apply(serializeStableSystemAuditJson, undefined, [value])

  expect(serialized).toBeInstanceOf(SystemAuditJsonError)
  if (!(serialized instanceof SystemAuditJsonError)) {
    throw new Error("expected invalid audit JSON to return an error")
  }
  expect(serialized.code).toBe("invalid_json")
}

function expectPayloadTooLarge(value: SystemAuditJsonValue): void {
  const serialized = serializeStableSystemAuditJson(value)

  expect(serialized).toBeInstanceOf(SystemAuditJsonError)
  if (!(serialized instanceof SystemAuditJsonError)) {
    throw new Error("expected oversized audit JSON to return an error")
  }
  expect(serialized.code).toBe("payload_too_large")
}

function requireSerializedJson(value: string | null | SystemAuditJsonError): string {
  expect(typeof value).toBe("string")
  if (typeof value !== "string") throw new Error("expected serialized audit JSON")

  return value
}

function makeSharedDag(depth: number, leaf: SystemAuditJsonValue): SystemAuditJsonValue {
  let value = leaf
  for (let index = 0; index < depth; index += 1) {
    value = { left: value, right: value }
  }

  return value
}

describe("StableSystemAuditJsonValue", () => {
  test("serializes primitives, arrays, and nested null without changing their meaning", () => {
    expect(serializeStableSystemAuditJson([null, true, false, 12.5, "text"])).toBe(
      '[null,true,false,12.5,"text"]',
    )
    expect(serializeStableSystemAuditJson(null)).toBeNull()
  })

  test("orders every object by Unicode code point and serializes manually", () => {
    const value = {
      z: 1,
      nested: { token: "raw", a: 2 },
    }

    expect(serializeStableSystemAuditJson(value)).toBe(
      '{"nested":{"a":2,"token":"[REDACTED]"},"z":1}',
    )
  })

  test("keeps integer-like keys in code point order instead of JSON property order", () => {
    expect(serializeStableSystemAuditJson({ 2: "two", 10: "ten", 1: "one" })).toBe(
      '{"1":"one","10":"ten","2":"two"}',
    )
  })

  test("orders BMP keys before astral keys according to Unicode code points", () => {
    const bmp = "\u{e000}"
    const astral = "\u{10000}"

    expect(serializeStableSystemAuditJson({ [astral]: "astral", [bmp]: "bmp", a: "ascii" })).toBe(
      `{"a":"ascii","${bmp}":"bmp","${astral}":"astral"}`,
    )
  })

  test("redacts every normalized secret-key variant but preserves token_version", () => {
    const value = {
      password: "raw",
      PASSWORD: "raw",
      secret: "raw",
      token: "raw",
      Authorization: "raw",
      cookie: "raw",
      "set-cookie": "raw",
      private_key: "raw",
      "client-secret": "raw",
      apiKey: "raw",
      accessToken: "raw",
      refresh_token: "raw",
      currentPassword: "raw",
      newPassword: "raw",
      jwtSecret: "raw",
      password_hash: "raw",
      token_version: 7,
    }
    const serialized = requireSerializedJson(serializeStableSystemAuditJson(value))
    const parsed: unknown = JSON.parse(serialized)
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("expected an audit JSON object")
    }

    for (const key of Object.keys(value).filter((key) => key !== "token_version")) {
      expect(Reflect.get(parsed, key)).toBe("[REDACTED]")
    }
    expect(Reflect.get(parsed, "token_version")).toBe(7)
  })

  test("redacts secrets recursively through arrays and objects", () => {
    expect(
      serializeStableSystemAuditJson({
        entries: [{ nested: { RefreshToken: "raw" } }],
        safe: "visible",
      }),
    ).toBe('{"entries":[{"nested":{"RefreshToken":"[REDACTED]"}}],"safe":"visible"}')
  })

  test("allows null-prototype plain objects", () => {
    const value: Record<string, SystemAuditJsonValue> = Object.create(null)
    value.z = 1
    value.a = 2

    expect(serializeStableSystemAuditJson(value)).toBe('{"a":2,"z":1}')
  })

  test("allows non-cyclic shared references", () => {
    const shared = { a: 1 }

    expect(serializeStableSystemAuditJson({ left: shared, right: shared })).toBe(
      '{"left":{"a":1},"right":{"a":1}}',
    )
  })

  test("does not mutate the source while ordering and redacting", () => {
    const value = { z: [{ password: "raw", b: 2, a: 1 }], a: "first" }
    const snapshot = structuredClone(value)

    expect(serializeStableSystemAuditJson(value)).toBe(
      '{"a":"first","z":[{"a":1,"b":2,"password":"[REDACTED]"}]}',
    )
    expect(value).toEqual(snapshot)
    expect(value.z[0]?.password).toBe("raw")
  })

  test.each([
    ["undefined", undefined],
    ["bigint", 1n],
    ["NaN", Number.NaN],
    ["positive infinity", Number.POSITIVE_INFINITY],
    ["negative infinity", Number.NEGATIVE_INFINITY],
    ["function", () => undefined],
    ["symbol", Symbol("value")],
    ["Date", new Date("2026-01-01T00:00:00Z")],
    ["class instance", new (class AuditValue {})()],
  ])("rejects unsupported %s values", (_name, value) => {
    expectInvalidJson(value)
  })

  test("rejects symbol keys", () => {
    const value = { safe: true, [Symbol("hidden")]: "raw" }

    expectInvalidJson(value)
  })

  test("rejects accessors without executing their getter", () => {
    let getterCalls = 0
    const value: Record<string, unknown> = Object.create(null)
    Object.defineProperty(value, "password", {
      enumerable: true,
      get() {
        getterCalls += 1
        throw new Error("getter must not execute")
      },
    })

    expectInvalidJson(value)
    expect(getterCalls).toBe(0)
  })

  test("rejects array accessors without executing their getter", () => {
    let getterCalls = 0
    const value: unknown[] = []
    Object.defineProperty(value, "0", {
      enumerable: true,
      get() {
        getterCalls += 1
        throw new Error("getter must not execute")
      },
    })
    value.length = 1

    expectInvalidJson(value)
    expect(getterCalls).toBe(0)
  })

  test("serializes an array Proxy without executing its get trap", () => {
    let getCalls = 0
    const value = new Proxy(["first", { safe: true }], {
      get(target, property, receiver) {
        getCalls += 1
        return Reflect.get(target, property, receiver)
      },
    })

    expect(serializeStableSystemAuditJson(value)).toBe('["first",{"safe":true}]')
    expect(getCalls).toBe(0)
  })

  test("uses one descriptor snapshot when a stateful Proxy hides an unsupported key later", () => {
    let ownKeysCalls = 0
    let getCalls = 0
    const target = { safe: true, bad: undefined }
    const value = new Proxy(target, {
      ownKeys() {
        ownKeysCalls += 1
        return ownKeysCalls === 1 ? ["safe", "bad"] : ["safe"]
      },
      get(targetValue, property, receiver) {
        getCalls += 1
        return Reflect.get(targetValue, property, receiver)
      },
    })

    expectInvalidJson(value)
    expect(ownKeysCalls).toBe(1)
    expect(getCalls).toBe(0)
  })

  test("rejects sparse arrays", () => {
    const sparse: unknown[] = []
    sparse.length = 2

    expectInvalidJson(sparse)
  })

  test("rejects direct and mutual cycles while allowing the test harness to inspect the error", () => {
    const direct: Record<string, unknown> = {}
    direct.self = direct
    expectInvalidJson(direct)

    const left: Record<string, unknown> = {}
    const right: Record<string, unknown> = { left }
    left.right = right
    expectInvalidJson(left)
  })

  test("rejects invalid values and cycles even when their key would be redacted", () => {
    expectInvalidJson({ password: Symbol("hidden") })

    const cyclicSecret: Record<string, unknown> = {}
    cyclicSecret.token = cyclicSecret
    expectInvalidJson(cyclicSecret)
  })

  test("rejects excessive depth as an application error instead of leaking RangeError", () => {
    const root: Record<string, unknown> = {}
    let cursor = root
    for (let index = 0; index < 2_000; index += 1) {
      const child: Record<string, unknown> = {}
      cursor.child = child
      cursor = child
    }

    expectInvalidJson(root)
  })

  test.each([18, 99])(
    "rejects a depth-%i shared DAG at the output budget without repeated validation",
    (depth) => {
      let ownKeysCalls = 0
      const leaf = new Proxy(
        { value: "leaf" },
        {
          ownKeys(target) {
            ownKeysCalls += 1
            if (ownKeysCalls > 32) throw new Error("descriptor snapshot repeated")
            return Reflect.ownKeys(target)
          },
        },
      )

      expectPayloadTooLarge(makeSharedDag(depth, leaf))
      expect(ownKeysCalls).toBe(1)
    },
  )

  test("validates a redacted shared DAG once without generating its discarded projection", () => {
    let ownKeysCalls = 0
    const leaf = new Proxy(
      { value: "leaf" },
      {
        ownKeys(target) {
          ownKeysCalls += 1
          if (ownKeysCalls > 32) throw new Error("descriptor snapshot repeated")
          return Reflect.ownKeys(target)
        },
      },
    )

    // The sensitive property adds one edge; 98 shared wrappers plus the leaf object
    // stay at the existing maximum depth of 100.
    expect(serializeStableSystemAuditJson({ password: makeSharedDag(98, leaf) })).toBe(
      '{"password":"[REDACTED]"}',
    )
    expect(ownKeysCalls).toBe(1)
  })

  test("fails closed when validation work exceeds its bounded budget", () => {
    const values = Array.from({ length: 100_001 }, () => null)

    expectPayloadTooLarge({ password: values })
  })

  test("rejects an object whose key lower bound exceeds the budget before sorting", () => {
    const value: Record<string, SystemAuditJsonValue> = {}
    for (let index = 0; index < 10_000; index += 1) {
      value[`key_${String(index).padStart(5, "0")}`] = 0
    }

    const originalDescriptor = Object.getOwnPropertyDescriptor(String.prototype, "codePointAt")
    if (originalDescriptor === undefined || typeof originalDescriptor.value !== "function") {
      throw new Error("String.prototype.codePointAt must be available")
    }
    const originalCodePointAt = originalDescriptor.value
    let codePointComparisons = 0
    Object.defineProperty(String.prototype, "codePointAt", {
      ...originalDescriptor,
      value: function (this: string, position?: number): number | undefined {
        codePointComparisons += 1
        return Reflect.apply(originalCodePointAt, this, [position])
      },
    })
    try {
      expectPayloadTooLarge(value)
    } finally {
      Object.defineProperty(String.prototype, "codePointAt", originalDescriptor)
    }

    expect(codePointComparisons).toBe(0)
  })

  test("allows exactly 65,536 UTF-8 bytes", () => {
    const serialized = requireSerializedJson(
      serializeStableSystemAuditJson({ value: "x".repeat(65_524) }),
    )

    expect(new TextEncoder().encode(serialized).byteLength).toBe(65_536)
  })

  test("rejects 65,537 UTF-8 bytes", () => {
    expectPayloadTooLarge({ value: "x".repeat(65_525) })
  })

  test("uses UTF-8 bytes, not JavaScript string length, at the multi-byte boundary", () => {
    const exactlyAtLimit = `a${"€".repeat(21_841)}`
    const aboveLimit = `aa${"€".repeat(21_841)}`
    const serialized = requireSerializedJson(
      serializeStableSystemAuditJson({ value: exactlyAtLimit }),
    )

    expect(new TextEncoder().encode(serialized).byteLength).toBe(65_536)
    expectPayloadTooLarge({ value: aboveLimit })
  })
})
