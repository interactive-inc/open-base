import { toConnectionErrorMessage } from "@/lib/http/to-connection-error-message"
import { describe, expect, test } from "bun:test"

const baseUrl = "http://127.0.0.1:8787"

describe("toConnectionErrorMessage", () => {
  test("maps a connection failure to a message with the base url", () => {
    const message = toConnectionErrorMessage(new TypeError("fetch failed"), baseUrl)

    expect(message).toContain(baseUrl)
    expect(message).toContain("接続できませんでした")
  })

  test("maps a timeout (TimeoutError/AbortError) to a timeout message", () => {
    const timeout = new Error("The operation timed out")
    timeout.name = "TimeoutError"

    const message = toConnectionErrorMessage(timeout, baseUrl)

    expect(message).toContain(baseUrl)
    expect(message).toContain("タイムアウト")
  })

  test("returns null for a non-connection error so the original message is kept", () => {
    expect(toConnectionErrorMessage(new Error("some internal bug"), baseUrl)).toBeNull()
  })

  test("returns null for a non-Error value", () => {
    expect(toConnectionErrorMessage("boom", baseUrl)).toBeNull()
  })
})
