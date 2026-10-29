import { expect, test } from "bun:test"
import { readResponseErrorBody } from "@base/http/read-response-error-body"

for (const body of ["", "example error", '{"error":"example"}']) {
  test(`読めた本文を一度だけ返す: ${JSON.stringify(body)}`, async () => {
    const state = { reads: 0 }
    const response = {
      text: async () => {
        state.reads += 1
        return body
      },
    }
    expect(await readResponseErrorBody(response)).toBe(body)
    expect(state.reads).toBe(1)
  })
}

for (const aborted of [false, true]) {
  test(`本文の読取失敗と呼出し側の中断を区別する: aborted=${aborted}`, async () => {
    const caller = new AbortController()
    if (aborted) caller.abort()
    const failure = new Error("example-body-failure")
    const state = { reads: 0 }
    const response = {
      text: async () => {
        state.reads += 1
        throw failure
      },
    }
    const body = await readResponseErrorBody(response, caller.signal).catch(
      (error: unknown) => error,
    )
    expect(body).toBe(aborted ? failure : null)
    expect(state.reads).toBe(1)
  })
}
