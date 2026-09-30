import { describe, expect, test } from "bun:test"
import { toNegotiatedProblemResponse } from "@system/interface/problem-details/lib/to-negotiated-problem-response"

describe("toNegotiatedProblemResponse", () => {
  const props = {
    accept: "application/problem+json",
    status: 404,
    code: "account_not_found",
    detail: "account not found",
    sourceBody: { error: "account not found", code: "account_not_found" },
  } as const

  test("returns Problem Details only for an explicit opt-in", async () => {
    const response = toNegotiatedProblemResponse(props)
    const body = (await response?.json()) as object

    expect(response?.status).toBe(404)
    expect(response?.headers.get("content-type")).toBe("application/problem+json")
    expect(response?.headers.get("vary")).toBe("Accept")
    expect(body).toEqual({
      type: "/problems/account_not_found",
      title: "Not Found",
      status: 404,
      detail: "account not found",
      code: "account_not_found",
    })
  })

  test("leaves source, rejected, and unsupported requests untouched", () => {
    expect(toNegotiatedProblemResponse({ ...props, accept: null })).toBeNull()
    expect(
      toNegotiatedProblemResponse({ ...props, accept: "application/problem+json; q=0" }),
    ).toBeNull()
    expect(toNegotiatedProblemResponse({ ...props, accept: "*/*" })).toBeNull()
    expect(toNegotiatedProblemResponse({ ...props, status: 418 })).toBeNull()
  })

  test("keeps safe public extensions without allowing reserved member spoofing", async () => {
    const response = toNegotiatedProblemResponse({
      ...props,
      status: 422,
      code: "invalid_request",
      detail: "invalid request",
      sourceBody: {
        error: "invalid request",
        code: "invalid_request",
        type: "https://attacker.example/problem",
        status: 200,
        cause: "database credentials",
        issues: [{ path: ["name"], message: "required" }],
      },
    })
    const body = (await response?.json()) as object

    expect(body).toEqual({
      type: "/problems/invalid_request",
      title: "Unprocessable Content",
      status: 422,
      detail: "invalid request",
      code: "invalid_request",
      issues: [{ path: ["name"], message: "required" }],
    })
  })

  test("preserves existing headers and response variance", () => {
    const response = toNegotiatedProblemResponse({
      ...props,
      headers: new Headers({
        "content-type": "application/json",
        vary: "Origin",
        "x-request-id": "req-1",
      }),
    })

    expect(response?.headers.get("content-type")).toBe("application/problem+json")
    expect(response?.headers.get("vary")).toBe("Origin, Accept")
    expect(response?.headers.get("x-request-id")).toBe("req-1")
  })
})
