import { expect, test } from "bun:test"
import { SessionRefreshCoordinator } from "@/lib/session-refresh-coordinator"

test("shares one refresh per endpoint without crossing authentication boundaries", async () => {
  const calls: string[] = []
  const coordinator = new SessionRefreshCoordinator({
    refresh: async (baseUrl) => {
      calls.push(baseUrl)
      await Bun.sleep(5)
      return `token-for-${baseUrl}`
    },
  })
  const first = { baseUrl: "https://first.example.com", failedToken: "example-expired" }
  const second = { baseUrl: "https://second.example.com", failedToken: "example-expired" }

  expect(
    await Promise.all([
      coordinator.refresh(first),
      coordinator.refresh(first),
      coordinator.refresh(second),
    ]),
  ).toEqual([
    "token-for-https://first.example.com",
    "token-for-https://first.example.com",
    "token-for-https://second.example.com",
  ])
  expect(calls).toEqual([first.baseUrl, second.baseUrl])
})

test("a rejected operation releases the endpoint for a later independent attempt", async () => {
  const calls: boolean[] = []
  const coordinator = new SessionRefreshCoordinator({
    refresh: async () => {
      calls.push(true)
      if (calls.length === 1) throw new Error("unavailable")
      return "example-recovered"
    },
  })
  const input = { baseUrl: "https://api.example.com", failedToken: null }

  expect(
    (await Promise.allSettled([coordinator.refresh(input), coordinator.refresh(input)])).map(
      (outcome) => outcome.status,
    ),
  ).toEqual(["rejected", "rejected"])
  expect(await coordinator.refresh(input)).toBe("example-recovered")
  expect(calls.length).toBe(2)
})
