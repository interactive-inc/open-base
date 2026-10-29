import { expect, test } from "bun:test"
import { Hono } from "hono"
import { hc } from "hono/client"
import { encodePathParams } from "@base/http/encode-path-params"

const app = new Hono().get("/records/:id", (context) => context.text(context.req.param("id")))
const client = hc<typeof app>("https://example.com", { fetch: app.request })

for (const id of [
  "12345678-1234-4abc-8def-1234567890ab",
  "../../other/action",
  "研究/開発?#%",
  "back\\slash",
  "%2e%2e%2fother",
  "$&replacement",
]) {
  test(`a path parameter round-trips as one opaque value: ${id}`, async () => {
    const original = Object.freeze({ id })
    const param = encodePathParams(original)
    const url = client.records[":id"].$url({ param })
    expect(url.pathname).toBe("/records/" + encodeURIComponent(id))
    expect(url.search).toBe("")
    expect(url.hash).toBe("")
    expect(await (await client.records[":id"].$get({ param })).text()).toBe(id)
    expect(original.id).toBe(id)
  })
}

test("empty and dot-segment identifiers are rejected before URL construction", () => {
  for (const id of ["", ".", ".."]) {
    expect(() => encodePathParams({ id })).toThrow("invalid URL path parameter")
  }
  expect(encodePathParams({ accountId: "example-account", bindingId: "part/child" })).toEqual({
    accountId: "example-account",
    bindingId: "part%2Fchild",
  })
})
