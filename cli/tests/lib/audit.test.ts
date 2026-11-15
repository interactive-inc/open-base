import { expect, test } from "bun:test"
import { help } from "@/app/audit/route"
import { createCliFixtures } from "@/tests/support/create-cli-fixtures"
import { describeApiCommands, STEP_UP_TOKEN } from "@/tests/support/describe-api-commands"
import { runCliInProcess } from "@/tests/support/run-cli-in-process"

const fixtures = createCliFixtures("audit")
const event = crypto.randomUUID()
const range = { from: "2026-04-01T00:00:00Z", to: "2026-04-30T00:00:00Z", outcome: "denied" }
const rangeFile = fixtures.writeJson("range.json", range)
const policy = {
  scope: "*",
  commandId: crypto.randomUUID(),
  expectedRevision: 0,
  enabled: true,
  allowedFields: [],
  allowedTargetTypes: null,
  allowedPurposes: ["investigation"],
  expiresAt: null,
  reason: "調査のため",
}
const policyFile = fixtures.writeJson("policy.json", policy)
const repairPolicy = { ...policy, scope: crypto.randomUUID(), supersedesLegacyRevision: 3 }
const repairFile = fixtures.writeJson("repair.json", repairPolicy)

describeApiCommands({
  group: "audit",
  help,
  cases: [
    {
      name: "company list",
      argv: ["audit", "company", "list", "--outcome", "denied", "--cursor", "next-1"],
      expected: {
        method: "GET",
        path: "/company/audit-events",
        query: { outcome: "denied", cursor: "next-1" },
      },
    },
    {
      name: "company show",
      argv: ["audit", "company", "show", event],
      expected: { method: "GET", path: `/company/audit-events/${event}` },
    },
    {
      name: "company export",
      argv: ["audit", "company", "export", "--data", rangeFile],
      expected: { method: "POST", path: "/company/audit-event-exports", body: range },
    },
    {
      name: "system list",
      argv: [
        "audit",
        "system",
        "list",
        "--purpose",
        "investigation",
        "--offset",
        "50",
        "--boundary",
        "b-1",
      ],
      expected: {
        method: "GET",
        path: "/system/audit-events",
        query: { purpose: "investigation", offset: "50", boundary: "b-1" },
      },
    },
    {
      name: "system show",
      argv: ["audit", "system", "show", event, "--purpose", "investigation"],
      expected: {
        method: "GET",
        path: `/system/audit-events/${event}`,
        query: { purpose: "investigation" },
      },
    },
    {
      name: "disclosure-policies show",
      argv: ["audit", "disclosure-policies", "show", "--scope", "*"],
      expected: { method: "GET", path: "/system/audit-disclosure-policies", query: { scope: "*" } },
    },
    {
      name: "disclosure-policies publish",
      argv: [
        "audit",
        "disclosure-policies",
        "publish",
        "--data",
        policyFile,
        "--step-up",
        STEP_UP_TOKEN,
      ],
      expected: {
        method: "POST",
        path: "/system/audit-disclosure-policies",
        headers: { "x-system-step-up": STEP_UP_TOKEN },
        body: policy,
      },
    },
  ],
})

test("旧設定を引き継ぐ指定と本人確認をそのまま送る", async () => {
  const run = await runCliInProcess(
    ["audit", "disclosure-policies", "publish", "--data", repairFile, "--step-up", STEP_UP_TOKEN],
    () => Response.json({ policy: repairPolicy }),
  )
  expect(run.status).toBe(200)
  expect(run.requests).toHaveLength(1)
  const request = run.requests[0]
  expect(request).toBeDefined()
  expect(request?.body).toEqual(repairPolicy)
})

test("audit company export はCSVを整形せずにそのまま出す", async () => {
  const csv = "occurred_at,action\n2026-04-01T00:00:00Z,example.read\n"
  const run = await runCliInProcess(
    ["audit", "company", "export", "--data", rangeFile],
    () => new Response(csv, { headers: { "content-type": "text/csv; charset=utf-8" } }),
  )

  expect({ status: run.status, text: run.text }).toEqual({ status: 200, text: csv })
})

test("audit disclosure-policies show は --scope が無いと送らずに断る", async () => {
  const run = await runCliInProcess(["audit", "disclosure-policies", "show"])

  expect({ status: run.status, count: run.requests.length }).toEqual({ status: 400, count: 0 })
})
