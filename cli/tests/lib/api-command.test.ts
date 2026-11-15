import { expect, test } from "bun:test"
import { resolveApiCommand } from "@/lib/command/resolve-api-command"
import type { ApiCommandGroup } from "@/lib/command/types"
import { createCliFixtures } from "@/tests/support/create-cli-fixtures"
import { runCliInProcess } from "@/tests/support/run-cli-in-process"

const fixtures = createCliFixtures("api-command")
const withoutEnvelope = fixtures.writeJson("change.json", { reason: "確認した", resources: [] })

const group: ApiCommandGroup = {
  name: "example",
  summary: "example",
  defaultCommand: null,
  notes: "",
  commands: {
    archives: { summary: "one", method: "GET", path: "/archives/:id" },
    "archives by-owner": { summary: "owner", method: "GET", path: "/archives/by-owner/:id" },
  },
}

test("最も長く一致するコマンドを選び、残りを識別子として受け取る", () => {
  expect(resolveApiCommand(group, ["archives", "by-owner", "o-1"])?.name).toBe("archives by-owner")
  expect(resolveApiCommand(group, ["archives", "a-1"])?.ids).toEqual(["a-1"])
})

test("識別子の数が経路と合わない・別の経路へ届く値は受け取らない", () => {
  expect(resolveApiCommand(group, ["archives"])).toBeNull()
  expect(resolveApiCommand(group, ["archives", "a-1", "a-2"])).toBeNull()
  expect(resolveApiCommand(group, ["archives", ".."])).toBeNull()
  expect(resolveApiCommand(group, ["archives", "a b"])).toBeNull()
  expect(resolveApiCommand(group, ["unknown", "a-1"])).toBeNull()
})

test("必須の引数やヘッダーが欠けると何も送らずに断る", async () => {
  const cases: ReadonlyArray<ReadonlyArray<string>> = [
    ["roles", "show", "viewer", "--unknown", "1"],
    ["roles", "show", "viewer", "--step-up", "a".repeat(64)],
    ["roles", "delete", "viewer", "--step-up", "not-hex"],
    ["company", "employees", "list"],
    ["company", "employees", "save", "--data", withoutEnvelope, "--idempotency-key", "key-1"],
    ["company", "employees", "save", "--idempotency-key", "key-1"],
    ["company", "my-profile", "update", "--data", withoutEnvelope],
    ["company", "resource-history", "employee", "--organization-id", "org-1"],
    ["connectors", "deliveries", "list"],
    ["accounts", "unknown"],
  ]

  for (const argv of cases) {
    const run = await runCliInProcess(argv)
    expect({ argv, status: run.status, count: run.requests.length }).toEqual({
      argv,
      status: 400,
      count: 0,
    })
  }
})

test("APIの失敗はそのままの状態で返す", async () => {
  const run = await runCliInProcess(["roles", "show", "viewer"], () =>
    Response.json({ error: "role_not_found" }, { status: 404 }),
  )

  expect(run.status).toBe(404)
  expect(run.text).toContain("role_not_found")
})
