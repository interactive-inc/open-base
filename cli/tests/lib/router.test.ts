import { toRequest } from "@/lib/router/router"
import { describe, expect, spyOn, test } from "bun:test"

describe("toRequest", () => {
  test("maps positional args to path segments and --flag value to body", () => {
    const result = toRequest(["leave-requests", "approve", "--id", "5"])

    expect(result.path).toBe("/leave-requests/approve")
    expect(result.body).toEqual({ id: "5" })
  })

  test("maps a known short flag with its value", () => {
    const result = toRequest(["knowledge", "-q", "remote"])

    expect(result.path).toBe("/knowledge")
    expect(result.body).toEqual({ q: "remote" })
  })

  test("warns on an unknown short flag and ignores it", () => {
    // expect が throw しても確実に復元するため try/finally で囲う。
    const spy = spyOn(process.stderr, "write").mockImplementation(() => true)

    try {
      const result = toRequest(["foo", "-x"])

      expect(spy).toHaveBeenCalled()
      expect(result.path).toBe("/foo")
      expect(result.body).toEqual({})
    } finally {
      spy.mockRestore()
    }
  })
})
