// @vitest-environment node
import { createServer } from "node:http"
import type { Server } from "node:http"
import { afterAll, afterEach, beforeAll, beforeEach, expect, test, vi } from "vite-plus/test"
import { apiFetch } from "@/lib/api/api-fetch"
import { postLogin } from "@/lib/api/post-login"
import { postRefreshToken } from "@/lib/api/post-refresh-token"
import { exchangeIdentityCode } from "@/lib/auth/exchange-identity-code"

const mocks = vi.hoisted(() => ({ context: vi.fn(), session: vi.fn() }))
vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: mocks.context }))
vi.mock("@/lib/auth/get-server-session", () => ({ getServerSession: mocks.session }))

const fixture = {
  sourceUrl: "",
  targetUrl: "",
  status: 307,
  mode: "redirect",
  requests: new Array<string>(),
  received: new Array<{ method: string | undefined; body: string }>(),
}
const target = createServer((request, response) => {
  request.setEncoding("utf8")
  const body = { text: "" }
  request.on("data", (chunk: string) => {
    body.text += chunk
  })
  request.on("end", () => {
    fixture.received.push({ method: request.method, body: body.text })
    response.writeHead(200, { "content-type": "application/json" })
    response.end(
      JSON.stringify({
        access_token: "foreign-access",
        refresh_token: "foreign-refresh",
        id_token: "foreign-identity",
      }),
    )
  })
})
const source = createServer((request, response) => {
  fixture.requests.push(`${request.method} ${request.url}`)
  if (fixture.mode === "success" || request.url === "/target") {
    response.writeHead(200, { "content-type": "application/json" })
    response.end(
      JSON.stringify({
        access_token: "example-access",
        refresh_token: "example-refresh",
        id_token: "example-identity",
      }),
    )
    return
  }
  const location =
    (fixture.mode === "same-origin" ? fixture.sourceUrl : fixture.targetUrl) + "/target"
  response.writeHead(fixture.status, { location })
  response.end()
})
async function listen(server: Server): Promise<string> {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const address = server.address()
  if (address === null || typeof address === "string") throw new Error("missing HTTP address")
  return `http://127.0.0.1:${address.port}`
}
async function close(server: Server): Promise<void> {
  server.closeAllConnections()
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  )
}
beforeAll(async () => {
  fixture.targetUrl = await listen(target)
  fixture.sourceUrl = await listen(source)
})
afterAll(async () => {
  await close(source)
  await close(target)
})
beforeEach(() => {
  fixture.requests.length = 0
  fixture.received.length = 0
  fixture.status = 307
  fixture.mode = "redirect"
  mocks.context.mockReturnValue({ env: {} })
  mocks.session.mockResolvedValue(null)
  vi.stubEnv("NEXT_PUBLIC_API_URL", fixture.sourceUrl)
})
afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllEnvs()
})

test("Webログインのpasswordを別originのredirect先へ転送しない", async () => {
  const result = await postLogin({ email: "you@example.com", password: "example-password" }).catch(
    (error: unknown) => error,
  )
  expect(fixture.received).toEqual([])
  expect(result).toBeInstanceOf(Error)
})
test("Webのrefresh tokenを別originのredirect先へ転送しない", async () => {
  const result = await postRefreshToken("example-refresh")
  expect(fixture.received).toEqual([])
  expect(result).toBeInstanceOf(Error)
})
test("identity codeとPKCE verifierを別originのredirect先へ転送しない", async () => {
  const result = await exchangeIdentityCode({
    issuer: fixture.sourceUrl,
    code: "example-code",
    codeVerifier: "v".repeat(43),
    redirectUri: "https://app.example.com/auth/callback",
  })
  expect(fixture.received).toEqual([])
  expect(result).toBeInstanceOf(Error)
})

for (const status of [301, 302, 303, 308]) {
  test(`Web APIは${status}の転送先へ接続しない`, async () => {
    fixture.status = status
    expect(await postRefreshToken("example-refresh")).toBeInstanceOf(Error)
    expect(fixture.received).toEqual([])
    expect(fixture.requests).toEqual(["PATCH /system/sessions"])
  })
  test(`identity交換は${status}の転送先へ接続しない`, async () => {
    fixture.status = status
    expect(
      await exchangeIdentityCode({
        issuer: fixture.sourceUrl,
        code: "example-code",
        codeVerifier: "v".repeat(43),
        redirectUri: "https://app.example.com/auth/callback",
      }),
    ).toBeInstanceOf(Error)
    expect(fixture.received).toEqual([])
    expect(fixture.requests).toEqual(["POST /token"])
  })
}

for (const operation of ["api", "identity"]) {
  test(`${operation}は同一originの別pathにも追従しない`, async () => {
    fixture.mode = "same-origin"
    const result =
      operation === "api"
        ? await postRefreshToken("example-refresh")
        : await exchangeIdentityCode({
            issuer: fixture.sourceUrl,
            code: "example-code",
            codeVerifier: "v".repeat(43),
            redirectUri: "https://app.example.com/auth/callback",
          })
    expect(result).toBeInstanceOf(Error)
    expect(fixture.requests).toEqual([
      operation === "api" ? "PATCH /system/sessions" : "POST /token",
    ])
  })
}

test("bindingへ渡すRequestでもredirect:manualと明示拒否を維持する", async () => {
  const binding = { fetch: vi.fn((request: Request) => fetch(request)) }
  mocks.context.mockReturnValue({ env: { API_SERVICE: binding } })
  expect(await postRefreshToken("example-refresh")).toBeInstanceOf(Error)
  expect(binding.fetch).toHaveBeenCalledOnce()
  expect(binding.fetch.mock.calls[0]?.[0]?.redirect).toBe("manual")
  expect(fixture.received).toEqual([])
})

test("Requestやinitのfollow指定でも資格情報をredirect先へ送らない", async () => {
  const input = new Request(fixture.sourceUrl + "/system/work-items", {
    method: "POST",
    body: "example-body",
    headers: { "x-system-step-up": "1".repeat(64) },
    redirect: "follow",
  })
  const failure = await apiFetch(input, { redirect: "follow" }).catch((error: unknown) => error)
  expect(failure).toBeInstanceOf(Error)
  expect(fixture.received).toEqual([])
  expect(fixture.requests).toEqual(["POST /system/work-items"])
})

test("redirectしないAPIとidentity交換は正常に完了する", async () => {
  fixture.mode = "success"
  expect(await postLogin({ email: "you@example.com", password: "example-password" })).toEqual({
    access_token: "example-access",
    refresh_token: "example-refresh",
  })
  expect(await postRefreshToken("example-refresh")).toEqual({
    access_token: "example-access",
    refresh_token: "example-refresh",
  })
  expect(
    await exchangeIdentityCode({
      issuer: fixture.sourceUrl,
      code: "example-code",
      codeVerifier: "v".repeat(43),
      redirectUri: "https://app.example.com/auth/callback",
    }),
  ).toBe("example-identity")
  expect(fixture.received).toEqual([])
})
