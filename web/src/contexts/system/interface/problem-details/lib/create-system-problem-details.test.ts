import { describe, expect, test } from "bun:test"
import { createSystemProblemDetails } from "@system/interface/problem-details/lib/create-system-problem-details"

describe("createSystemProblemDetails", () => {
  test("creates a stable type without mixing occurrence detail into it", () => {
    const first = createSystemProblemDetails({
      status: 422,
      code: "identity/invalid #1",
      detail: "The first request is invalid.",
    })
    const second = createSystemProblemDetails({
      status: 422,
      code: "identity/invalid #1",
      detail: "A different request is invalid.",
    })

    expect(first).toEqual({
      type: "/problems/identity%2Finvalid%20%231",
      title: "Unprocessable Content",
      status: 422,
      detail: "The first request is invalid.",
      code: "identity/invalid #1",
    })
    expect(second.type).toBe(first.type)
    expect(second.title).toBe(first.title)
  })

  test("includes the occurrence instance only when supplied", () => {
    const problem = createSystemProblemDetails({
      status: 404,
      code: "account.not_found",
      detail: "The account was not found.",
      instance: "/requests/request-1",
    })

    expect(problem).toEqual({
      type: "/problems/account.not_found",
      title: "Not Found",
      status: 404,
      detail: "The account was not found.",
      code: "account.not_found",
      instance: "/requests/request-1",
    })
  })

  test("does not copy internal cause or arbitrary input fields", () => {
    const input: Readonly<{
      status: 500
      code: string
      detail: string
      cause: Error
      secret: string
    }> = {
      status: 500,
      code: "internal_error",
      detail: "The request could not be completed.",
      cause: new Error("database credentials"),
      secret: "must-not-leak",
    }

    const problem = createSystemProblemDetails(input)
    const serialized = JSON.stringify(problem)

    expect(serialized).not.toContain("database credentials")
    expect(serialized).not.toContain("must-not-leak")
    expect(Object.keys(problem).sort()).toEqual(["code", "detail", "status", "title", "type"])
  })
})
