import { describe, expect, test } from "bun:test"
import { Hono } from "hono"
import type { HonoEnv } from "@/env"
import {
  isReadOnlyMode,
  readOnlyModeMiddleware,
} from "@/api/http/middlewares/read-only-mode-middleware"

function createApp() {
  return new Hono<HonoEnv>()
    .use("*", readOnlyModeMiddleware)
    .all("*", (c) => c.text("ok"))
    .onError((error, c) => c.text(error.message, 403))
}

async function status(method: string, path: string, readOnlyMode: string | undefined) {
  const response = await createApp().request(path, { method }, { READ_ONLY_MODE: readOnlyMode })

  return response.status
}

describe("isReadOnlyMode", () => {
  test("未設定・空・false は無効、それ以外は有効にする", () => {
    expect(isReadOnlyMode(undefined)).toBe(false)
    expect(isReadOnlyMode("")).toBe(false)
    expect(isReadOnlyMode("false")).toBe(false)
    expect(isReadOnlyMode("true")).toBe(true)
    expect(isReadOnlyMode("yes")).toBe(true)
  })
})

describe("readOnlyModeMiddleware", () => {
  test("無効なら書き込みも通す", async () => {
    expect(await status("POST", "/company/application-requests", undefined)).toBe(200)
  })

  test("有効なら読み取りとセッション系だけ通す", async () => {
    expect(await status("GET", "/company/employees", "true")).toBe(200)
    expect(await status("POST", "/system/sessions", "true")).toBe(200)
    expect(await status("PATCH", "/system/sessions", "true")).toBe(200)
    expect(await status("DELETE", "/system/sessions", "true")).toBe(200)
  })

  test("有効なら本人向けを含む書き込みを拒否する", async () => {
    expect(await status("POST", "/company/application-requests", "true")).toBe(403)
    expect(await status("PUT", "/company/my-profile", "true")).toBe(403)
    expect(await status("POST", "/system/attachments", "true")).toBe(403)
    expect(await status("POST", "/system/sessions/extra", "true")).toBe(403)
  })
})
