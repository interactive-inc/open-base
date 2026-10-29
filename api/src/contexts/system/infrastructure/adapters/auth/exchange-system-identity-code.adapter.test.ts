import { expect, spyOn, test } from "bun:test"
import { ExchangeSystemIdentityCodeAdapter } from "@system/infrastructure/adapters/auth/exchange-system-identity-code.adapter"

for (const status of [301, 302, 303, 307, 308]) {
  test(`Identity code交換は${status}で別originへ追従しない`, async () => {
    const received: string[] = []
    const target = Bun.serve({
      port: 0,
      async fetch(request) {
        received.push(await request.text())
        return Response.json({ id_token: "foreign-identity" })
      },
    })
    const source = Bun.serve({
      port: 0,
      fetch() {
        return new Response(null, { status, headers: { location: target.url.toString() } })
      },
    })
    try {
      const exchanged = await new ExchangeSystemIdentityCodeAdapter().exchangeSystemIdentityCode({
        issuer: source.url.toString(),
        code: "example-code",
        codeVerifier: "example-verifier",
        redirectUri: "https://api.example.com/system/cli-authorization-callback",
      })
      expect(received).toEqual([])
      expect(exchanged).toBeInstanceOf(Error)
    } finally {
      await source.stop(true)
      await target.stop(true)
    }
  })
}

test("Identity code交換は同一originの別pathにも追従しない", async () => {
  const received: string[] = []
  const source = Bun.serve({
    port: 0,
    fetch(request) {
      received.push(new URL(request.url).pathname)
      if (received.length === 1)
        return new Response(null, { status: 307, headers: { location: "/other" } })
      return Response.json({ id_token: "unexpected-identity" })
    },
  })
  try {
    const exchanged = await new ExchangeSystemIdentityCodeAdapter().exchangeSystemIdentityCode({
      issuer: source.url.toString(),
      code: "example-code",
      codeVerifier: "example-verifier",
      redirectUri: "https://api.example.com/system/cli-authorization-callback",
    })
    expect(received).toEqual(["/token"])
    expect(exchanged).toBeInstanceOf(Error)
  } finally {
    await source.stop(true)
  }
})

test("Identity code交換は正規endpointへPKCEを送りtokenを返す", async () => {
  const received: { method: string; path: string; body: string }[] = []
  const source = Bun.serve({
    port: 0,
    async fetch(request) {
      received.push({
        method: request.method,
        path: new URL(request.url).pathname,
        body: await request.text(),
      })
      return Response.json({ id_token: "example-identity" })
    },
  })
  try {
    const exchanged = await new ExchangeSystemIdentityCodeAdapter().exchangeSystemIdentityCode({
      issuer: source.url.toString(),
      code: "example-code",
      codeVerifier: "example-verifier",
      redirectUri: "https://api.example.com/system/cli-authorization-callback",
    })
    expect(exchanged).toBe("example-identity")
    expect(received).toHaveLength(1)
    expect(received[0]?.method).toBe("POST")
    expect(received[0]?.path).toBe("/token")
    expect(Object.fromEntries(new URLSearchParams(received[0]?.body))).toEqual({
      grant_type: "authorization_code",
      code: "example-code",
      code_verifier: "example-verifier",
      redirect_uri: "https://api.example.com/system/cli-authorization-callback",
    })
  } finally {
    await source.stop(true)
  }
})

for (const cleanup of ["reject", "pending"]) {
  test(`redirect本文の破棄が${cleanup}でも交換失敗を返す`, async () => {
    const canceled: string[] = []
    const body = new ReadableStream({
      cancel() {
        canceled.push(cleanup)
        if (cleanup === "reject") return Promise.reject(new Error("example cancellation failure"))
        return new Promise<void>(() => undefined)
      },
    })
    const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(body, { status: 307, headers: { location: "https://target.example.com" } }),
    )
    try {
      const exchanged = await new ExchangeSystemIdentityCodeAdapter().exchangeSystemIdentityCode({
        issuer: "https://identity.example.com",
        code: "example-code",
        codeVerifier: "example-verifier",
        redirectUri: "https://api.example.com/system/cli-authorization-callback",
      })
      expect(exchanged).toBeInstanceOf(Error)
      expect(canceled).toEqual([cleanup])
    } finally {
      fetchSpy.mockRestore()
    }
  }, 1000)
}
