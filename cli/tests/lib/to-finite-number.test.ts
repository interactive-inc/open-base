import { toFiniteNumber } from "@/lib/to-finite-number"
import { describe, expect, test } from "bun:test"

describe("toFiniteNumber", () => {
  test("parses a finite number string", () => {
    expect(toFiniteNumber("123", "--n")).toBe(123)
    expect(toFiniteNumber("12.5", "--n")).toBe(12.5)
    expect(toFiniteNumber("-5", "--n")).toBe(-5)
  })

  test("throws a UsageError mentioning the flag on a non-numeric string", () => {
    expect(() => toFiniteNumber("abc", "--base")).toThrow("--base")
  })

  test("throws on a partially numeric string", () => {
    expect(() => toFiniteNumber("12abc", "--base")).toThrow()
  })

  test("throws when the value is undefined", () => {
    expect(() => toFiniteNumber(undefined, "--base")).toThrow()
  })

  test("throws on an empty string (Number('') would be 0)", () => {
    expect(() => toFiniteNumber("", "--score")).toThrow("--score")
  })

  test("throws on a whitespace-only string", () => {
    expect(() => toFiniteNumber("   ", "--score")).toThrow()
  })
})
