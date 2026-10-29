import { expect, test } from "bun:test"
import { refreshCurrentToken } from "@/lib/refresh-current-token"

test("a late 401 reuses a saved successor without rotating it again", async () => {
  const rotations: string[] = []
  const updates: string[] = []
  const token = await refreshCurrentToken({
    baseUrl: "https://api.example.com",
    failedToken: "example-expired",
    consumedRefreshTokens: new Map(),
    readTokens: async () => ({ token: "example-fresh", refresh_token: "example-rotated" }),
    rotate: async (_baseUrl, refreshToken) => {
      rotations.push(refreshToken)
      return null
    },
    saveTokens: async () => {
      throw new Error("must not save")
    },
    updateToken: (accessToken) => {
      updates.push(accessToken)
    },
  })

  expect(token).toBe("example-fresh")
  expect(rotations).toEqual([])
  expect(updates).toEqual(["example-fresh"])
})

test("a failed save is visible and cannot cause a consumed refresh token to be reused", async () => {
  const rotations: string[] = []
  const updates: string[] = []
  const props = {
    baseUrl: "https://api.example.com",
    failedToken: "example-expired",
    consumedRefreshTokens: new Map<string, string>(),
    readTokens: async () => ({ token: "example-expired", refresh_token: "example-old-refresh" }),
    rotate: async (_baseUrl: string, refreshToken: string) => {
      rotations.push(refreshToken)
      return { access_token: "example-fresh", refresh_token: "example-rotated" }
    },
    saveTokens: async () => {
      throw new Error("settings unavailable")
    },
    updateToken: (token: string) => {
      updates.push(token)
    },
  }

  const failure = await refreshCurrentToken(props).catch((error: unknown) => error)

  expect(failure).toBeInstanceOf(Error)
  expect(await refreshCurrentToken(props)).toBeNull()
  expect(rotations).toEqual(["example-old-refresh"])
  expect(updates).toEqual(["example-fresh"])
})
