import { expect, test } from "bun:test"
import { AuthenticationState } from "@/lib/authentication-state"

test("parallel initialization waits for one completed token read", async () => {
  const reads: string[] = []
  const authentication = new AuthenticationState({
    resolveBaseUrl: () => "https://api.example.com",
    readTokens: async (baseUrl) => {
      reads.push(baseUrl)
      await Bun.sleep(5)
      return { token: "example-access" }
    },
  })

  const sessions = await Promise.all([authentication.get(), authentication.get()])

  expect(reads).toEqual(["https://api.example.com"])
  expect(sessions).toEqual([
    { baseUrl: "https://api.example.com", token: "example-access" },
    { baseUrl: "https://api.example.com", token: "example-access" },
  ])
  authentication.updateToken("example-rotated")
  expect((await authentication.get()).token).toBe("example-rotated")
})

test("failed initialization can be retried without publishing a partial session", async () => {
  const reads: boolean[] = []
  const authentication = new AuthenticationState({
    resolveBaseUrl: () => "https://api.example.com",
    readTokens: async () => {
      reads.push(true)
      if (reads.length === 1) throw new Error("unavailable")
      return { token: null }
    },
  })

  expect(
    (await Promise.allSettled([authentication.get(), authentication.get()])).map(
      (entry) => entry.status,
    ),
  ).toEqual(["rejected", "rejected"])
  expect(await authentication.get()).toEqual({ baseUrl: "https://api.example.com", token: null })
  expect(reads.length).toBe(2)
})
