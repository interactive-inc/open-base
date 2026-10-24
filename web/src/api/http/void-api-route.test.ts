import { describe, expect, test } from "bun:test"
import { Hono, type Context } from "hono"
import { HTTPException } from "hono/http-exception"
import { voidApiRoute } from "@/api/http/void-api-route"

const env = { DB: {} }

function host(path: string, handler: ReturnType<typeof voidApiRoute>) {
  return new Hono().all(path, handler)
}

describe("voidApiRoute", () => {
  test("`/api` を外した経路でhandlerへ渡し、paramとqueryを保つ", async () => {
    const route = voidApiRoute("GET", "/system/items/:id", [
      (c: Context) => c.json({ id: c.req.param("id"), q: c.req.query("q") }),
    ])
    const response = await host("/api/system/items/:id", route).request(
      "/api/system/items/abc?q=1",
      {},
      env,
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ id: "abc", q: "1" })
  })

  test("`/api` で始まらない要求は経路に載せない", async () => {
    const route = voidApiRoute("GET", "/system/items", [() => new Response("reached")])
    const response = await host("/system/items", route).request("/system/items", {}, env)

    expect(response.status).toBe(404)
  })

  test("handlerの例外は共通のエラー応答へ変換する", async () => {
    const route = voidApiRoute("POST", "/system/items", [
      () => {
        throw new HTTPException(409, { message: "conflict" })
      },
    ])
    const response = await host("/api/system/items", route).request(
      "/api/system/items",
      { method: "POST", headers: { "content-type": "application/json" }, body: "{}" },
      env,
    )

    expect(response.status).toBe(409)
  })

  test("handlerを持たないexportは読み込み時に拒否する", () => {
    expect(() => voidApiRoute("GET", "/system/items", undefined)).toThrow(
      "route module does not export GET handlers",
    )
  })
})
