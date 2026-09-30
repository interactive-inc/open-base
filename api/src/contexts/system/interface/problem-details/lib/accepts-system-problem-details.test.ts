import { describe, expect, test } from "bun:test"
import { acceptsSystemProblemDetails } from "@system/interface/problem-details/lib/accepts-system-problem-details"

describe("acceptsSystemProblemDetails", () => {
  test("requires an explicit Problem Details media range", () => {
    expect(acceptsSystemProblemDetails(null)).toBe(false)
    expect(acceptsSystemProblemDetails("")).toBe(false)
    expect(acceptsSystemProblemDetails("application/json")).toBe(false)
    expect(acceptsSystemProblemDetails("*/*")).toBe(false)
    expect(acceptsSystemProblemDetails("application/*")).toBe(false)
  })

  test("accepts case-insensitive media types and unrelated parameters", () => {
    expect(acceptsSystemProblemDetails("application/problem+json")).toBe(true)
    expect(acceptsSystemProblemDetails("Application/Problem+Json; charset=utf-8")).toBe(true)
    expect(
      acceptsSystemProblemDetails("text/plain, application/problem+json; charset=utf-8; q=0.5"),
    ).toBe(true)
  })

  test("honors valid q-values and fails closed on malformed values", () => {
    expect(acceptsSystemProblemDetails("application/problem+json; q=0")).toBe(false)
    expect(acceptsSystemProblemDetails("application/problem+json; q=0.000")).toBe(false)
    expect(acceptsSystemProblemDetails("application/problem+json; q=0.001")).toBe(true)
    expect(acceptsSystemProblemDetails("application/problem+json; q=1.000")).toBe(true)
    expect(acceptsSystemProblemDetails("application/problem+json; q=.5")).toBe(false)
    expect(acceptsSystemProblemDetails("application/problem+json; q=1.001")).toBe(false)
    expect(acceptsSystemProblemDetails("application/problem+json; q=invalid")).toBe(false)
    expect(acceptsSystemProblemDetails("application/problem+json; q=1; q=0")).toBe(false)
    expect(acceptsSystemProblemDetails('application/problem+json; profile="a,b"; q=0')).toBe(false)
  })

  test("isolates an unsupported quoted range from a valid explicit range", () => {
    expect(acceptsSystemProblemDetails('text/plain; profile="a,b", application/problem+json')).toBe(
      true,
    )
  })

  test("accepts when at least one explicit duplicate range is selectable", () => {
    expect(
      acceptsSystemProblemDetails("application/problem+json; q=0, application/problem+json; q=0.8"),
    ).toBe(true)
  })
})
