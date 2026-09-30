import { describe, expect, test } from "bun:test"
import { negotiateSystemProblemDetails } from "@system/interface/problem-details/lib/negotiate-system-problem-details"

describe("negotiateSystemProblemDetails", () => {
  test("returns a safe Problem Details body for an explicit opt-in", () => {
    expect(
      negotiateSystemProblemDetails({
        accept: "application/problem+json",
        status: 422,
        code: "invalid_request",
        detail: "invalid request",
        sourceBody: {
          error: "spoofed",
          status: 200,
          cause: "internal",
          issues: [{ path: ["name"], message: "required" }],
        },
      }),
    ).toEqual({
      type: "/problems/invalid_request",
      title: "Unprocessable Content",
      status: 422,
      detail: "invalid request",
      code: "invalid_request",
      issues: [{ path: ["name"], message: "required" }],
    })
  })

  test("leaves source and unsupported status responses untouched", () => {
    const props = {
      status: 404,
      code: "not_found",
      detail: "not found",
      sourceBody: {},
    }

    expect(negotiateSystemProblemDetails({ ...props, accept: null })).toBeNull()
    expect(negotiateSystemProblemDetails({ ...props, accept: "*/*" })).toBeNull()
    expect(
      negotiateSystemProblemDetails({ ...props, accept: "application/problem+json", status: 418 }),
    ).toBeNull()
  })
})
