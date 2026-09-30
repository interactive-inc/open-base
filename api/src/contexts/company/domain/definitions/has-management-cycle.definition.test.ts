import { describe, expect, test } from "bun:test"
import { hasManagementCycle } from "@/contexts/company/domain/definitions/has-management-cycle.definition"

describe("hasManagementCycle", () => {
  test("accepts an empty graph and managers with no outgoing relations", () => {
    expect(hasManagementCycle(new Map<string, string[]>())).toBe(false)
    expect(hasManagementCycle(new Map([["employee", ["manager", "manager"]]]))).toBe(false)
  })

  test("rejects self-reporting and disconnected cycles", () => {
    expect(hasManagementCycle(new Map([["a", ["a"]]]))).toBe(true)
    expect(
      hasManagementCycle(
        new Map([
          ["unrelated", ["leader"]],
          ["a", ["b", "c"]],
          ["b", ["a"]],
        ]),
      ),
    ).toBe(true)
  })

  test("detects a cycle in either branch order without treating a shared manager as a cycle", () => {
    for (const managers of [
      ["b", "c"],
      ["c", "b"],
    ]) {
      const graph = new Map([
        ["a", managers],
        ["b", ["d"]],
        ["c", ["d"]],
      ])
      expect(hasManagementCycle(graph)).toBe(false)
      graph.set("b", ["a"])
      expect(hasManagementCycle(graph)).toBe(true)
      expect(hasManagementCycle(new Map([...graph].toReversed()))).toBe(true)
    }
  })

  test("handles deep branching without enumerating exponentially many paths or exhausting the stack", () => {
    const graph = new Map<string, string[]>()
    for (const index of Array.from({ length: 20_000 }, (_, index) => index)) {
      graph.set(`a:${index}`, [`a:${index + 1}`, `b:${index + 1}`])
      graph.set(`b:${index}`, [`a:${index + 1}`, `b:${index + 1}`])
    }
    expect(hasManagementCycle(graph)).toBe(false)
    graph.set("b:20000", ["a:0"])
    expect(hasManagementCycle(graph)).toBe(true)
  })
})
