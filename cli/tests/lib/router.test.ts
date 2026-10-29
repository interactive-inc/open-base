import { toRequest } from "@/lib/router/router"
import { UsageError } from "@/lib/errors"
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

  test("equals syntax preserves leading hyphens and additional equals", () => {
    const request = toRequest(["login", "--email", "you@example.com", "--password=--example=a=b"])
    expect(request.path).toBe("/login")
    expect(request.body).toEqual({ email: "you@example.com", password: "--example=a=b" })
  })

  test("only documented toggles can omit values without consuming a command", () => {
    expect(toRequest(["--help", "notifications", "list"]).body).toEqual({ help: "true" })
    expect(toRequest(["-h", "notifications"]).path).toBe("/notifications")
    expect(toRequest(["notifications", "list", "--unread"]).body).toEqual({ unread: "true" })
    expect(toRequest(["employees", "register", "--password-stdin"]).body).toEqual({
      "password-stdin": "true",
    })
  })

  test("explicit false disables a toggle and stdin hyphen remains an ordinary value", () => {
    expect(toRequest(["notifications", "list", "--unread", "false"]).body).toEqual({})
    expect(toRequest(["notifications", "list", "--unread", "--unread=false"]).body).toEqual({})
    expect(toRequest(["work-items", "create", "--data", "-"]).body).toEqual({ data: "-" })
    expect(() => toRequest(["notifications", "list", "--unread=invalid"])).toThrow(UsageError)
  })

  test("missing long and short values are rejected without quoting another argument", () => {
    for (const args of [
      ["login", "--password"],
      ["employees", "search", "-q"],
      ["login", "--password", "--example-private-value"],
    ]) {
      expect(() => toRequest(args)).toThrow(UsageError)
      try {
        toRequest(args)
      } catch (error) {
        expect(String(error)).not.toContain("example-private-value")
      }
    }
  })
})

test("dot segmentと空文字は位置に関係なくURL構築前に拒否する", () => {
  for (const value of ["", ".", ".."]) {
    for (const args of [[value], ["notifications", value], ["notifications", "show", value]]) {
      expect(() => toRequest(args)).toThrow(UsageError)
    }
  }
})

test("flagのdot値と空文字はbodyに保持する", () => {
  expect(toRequest(["example", "--data", ".", "--name=..", "--reason="]).body).toEqual({
    data: ".",
    name: "..",
    reason: "",
  })
})

test("dotを含む通常の識別子とencoded文字列は一つのsegmentとして保持する", () => {
  for (const value of [
    "example.delivery",
    "...",
    "../example",
    "%2e%2e",
    "研究/開発?#%",
    "back\\slash",
  ]) {
    const request = toRequest(["notifications", "show", value])
    expect(new URL(request.url).pathname).toBe("/notifications/show/" + encodeURIComponent(value))
    expect(new URL(request.url).search).toBe("")
    expect(new URL(request.url).hash).toBe("")
  }
})
