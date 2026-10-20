import { describe, expect, test } from "bun:test"
import { InvalidSystemProposalError } from "@system/domain/errors"
import { CanonicalSystemJsonValue } from "@system/domain/values/audit/canonical-system-json.value"

function serializeCanonicalSystemJson(value: unknown): string | InvalidSystemProposalError {
  const canonical = CanonicalSystemJsonValue.create(value)
  return canonical instanceof InvalidSystemProposalError ? canonical : canonical.toString()
}

describe("CanonicalSystemJsonValue", () => {
  test("object key順と入れ子を安定化し、入力を変更しない", () => {
    const input = { z: [3, { b: true, a: null }], a: "value" }
    const snapshot = structuredClone(input)

    expect(serializeCanonicalSystemJson(input)).toBe('{"a":"value","z":[3,{"a":null,"b":true}]}')
    expect(input).toEqual(snapshot)
  })

  test("ルートと入れ子の特殊なキーをown data propertyとして直列化する", () => {
    const input = JSON.parse(
      '{"value":1,"__proto__":{"requested":"root"},"nested":{"__proto__":{"requested":"child"}},"constructor":"constructor","prototype":"prototype","toString":"toString","hasOwnProperty":"hasOwnProperty"}',
    )
    const serialized = serializeCanonicalSystemJson(input)

    expect(serialized).toBe(
      '{"__proto__":{"requested":"root"},"constructor":"constructor","hasOwnProperty":"hasOwnProperty","nested":{"__proto__":{"requested":"child"}},"prototype":"prototype","toString":"toString","value":1}',
    )
    if (typeof serialized !== "string") return
    const normalized = JSON.parse(serialized)
    expect(Object.hasOwn(normalized, "__proto__")).toBe(true)
    expect(Object.hasOwn(normalized.nested, "__proto__")).toBe(true)
    expect(normalized).toEqual(input)
    expect(Object.getPrototypeOf(normalized)).toBe(Object.prototype)
  })

  test("__proto__の値の違いをcanonical JSONの違いとして保持する", () => {
    const left = CanonicalSystemJsonValue.create(
      JSON.parse('{"value":1,"__proto__":{"requested":"first"}}'),
    )
    const right = CanonicalSystemJsonValue.create(
      JSON.parse('{"value":1,"__proto__":{"requested":"second"}}'),
    )

    expect(left).toBeInstanceOf(CanonicalSystemJsonValue)
    expect(right).toBeInstanceOf(CanonicalSystemJsonValue)
    if (!(left instanceof CanonicalSystemJsonValue) || !(right instanceof CanonicalSystemJsonValue))
      return
    expect(left.toString()).not.toBe(right.toString())
    expect(left.equals(right)).toBe(false)
  })

  test.each([undefined, Number.NaN, Number.POSITIVE_INFINITY, 1n, new Date()])(
    "JSONではない値を拒否する",
    (input) => {
      expect(serializeCanonicalSystemJson(input)).toBeInstanceOf(InvalidSystemProposalError)
    },
  )

  test("循環参照、疎配列、accessorを拒否する", () => {
    const cyclic: Record<string, unknown> = {}
    cyclic.self = cyclic
    const sparse: unknown[] = []
    sparse.length = 1
    const accessor: Record<string, unknown> = {}
    Object.defineProperty(accessor, "value", {
      enumerable: true,
      get: () => "hidden",
    })

    expect(serializeCanonicalSystemJson(cyclic)).toBeInstanceOf(InvalidSystemProposalError)
    expect(serializeCanonicalSystemJson(sparse)).toBeInstanceOf(InvalidSystemProposalError)
    expect(serializeCanonicalSystemJson(accessor)).toBeInstanceOf(InvalidSystemProposalError)
  })

  test("1MBを超えるpayloadを拒否する", () => {
    const result = serializeCanonicalSystemJson({ value: "x".repeat(1_000_000) })

    expect(result).toBeInstanceOf(InvalidSystemProposalError)
    if (result instanceof InvalidSystemProposalError) expect(result.code).toBe("payload_too_large")
  })
})
