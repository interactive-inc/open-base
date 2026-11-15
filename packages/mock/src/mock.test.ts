import assert from "node:assert/strict"
import { afterAll, expect, test } from "bun:test"
import { getResponse } from "msw"
import { existsSync, mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createHandlers } from "./handlers.ts"
import { createMockState } from "./seed.ts"
import { createSqliteMock } from "./sqlite.ts"

const temporary: string[] = []
afterAll(() =>
  temporary.forEach((directory) => rmSync(directory, { recursive: true, force: true })),
)
const request = (path: string, init?: RequestInit) =>
  new Request(`http://localhost/api${path}`, init)

test("seed states are independent, unknown endpoints fail closed", async () => {
  const first = createMockState()
  const second = createMockState()
  first.notifications[0]!.read = true
  expect(second.notifications[0]!.read).toBe(false)
  expect((await getResponse(createHandlers(first), request("/not-implemented")))?.status).toBe(501)
  expect(
    (
      await getResponse(
        createHandlers(first),
        request("/company/dashboard", { method: "DELETE", body: "{}" }),
      )
    )?.status,
  ).toBe(405)
})

test("permissions and unlinked/signed-out boundaries remain distinct", async () => {
  for (const [scenario, path, status] of [
    ["member", "/company/dashboard", 403],
    ["unlinked", "/company/current-profile", 403],
    ["signed-out", "/company/current-profile", 401],
  ] as const)
    expect(
      (await getResponse(createHandlers(createMockState(scenario)), request(path)))?.status,
    ).toBe(status)
})

test("notification changes survive later reads only in their owned state", async () => {
  const handlers = createHandlers(createMockState())
  const read = await getResponse(
    handlers,
    request("/system/notifications/notification-1", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ read: true }),
    }),
  )
  expect(read?.status).toBe(200)
  expect(await read?.json()).toMatchObject({ id: "notification-1" })
  const response = await getResponse(handlers, request("/system/notifications/unread-count"))
  expect(await response?.json()).toEqual({ unread_count: 6 })
})

test("device approval is single-use and does not fabricate passkey success", async () => {
  const handlers = createHandlers(createMockState())
  const decide = () =>
    getResponse(
      handlers,
      request("/auth/device/approve", {
        method: "POST",
        body: JSON.stringify({ userCode: "DEMO-CODE" }),
      }),
    )
  expect((await decide())?.status).toBe(200)
  expect((await decide())?.status).toBe(409)
  expect(
    (await getResponse(handlers, request("/auth/passkey/register", { method: "POST", body: "{}" })))
      ?.status,
  ).toBe(501)
})

test("temporary SQLite can reopen saved synthetic state", async () => {
  const directory = mkdtempSync(join(tmpdir(), "base-mock-test-"))
  temporary.push(directory)
  const first = await createSqliteMock({ directory })
  first.state.notifications[0]!.read = true
  first.save()
  first.close()
  const reopened = await createSqliteMock({ directory })
  expect(reopened.state.notifications[0]!.read).toBe(true)
  expect(reopened.state.notifications[1]!.read).toBe(false)
  reopened.close()
  await assert.rejects(createSqliteMock({ directory: process.cwd() }), /一時ディレクトリー/)
})

test("unknown scenario names fail before a mock is started", () => {
  // @ts-expect-error runtime configuration can still provide an unsupported string
  expect(() => createMockState("unknown")).toThrow("BASE_MOCK_SCENARIO")
})

test("an explicit /tmp directory is available for local persistence", async () => {
  if (!existsSync("/tmp")) return
  const directory = mkdtempSync("/tmp/base-mock-explicit-")
  temporary.push(directory)
  const mock = await createSqliteMock({ directory })
  expect(mock.state.profile.email).toBe("you@example.com")
  mock.close()
})
