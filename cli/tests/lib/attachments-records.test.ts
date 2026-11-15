import { expect, test } from "bun:test"
import { readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { help as attachmentsHelp } from "@/app/attachments/route"
import { help as recordsHelp } from "@/app/records/route"
import { createCliFixtures } from "@/tests/support/create-cli-fixtures"
import { describeApiCommands, STEP_UP_TOKEN } from "@/tests/support/describe-api-commands"
import { runCliInProcess } from "@/tests/support/run-cli-in-process"

const fixtures = createCliFixtures("attachments")
const record = crypto.randomUUID()
const preservation = crypto.randomUUID()
const hold = {
  id: preservation,
  sha256: "b".repeat(64),
  kind: "hold",
  retainUntil: null,
  reason: "調査のため",
}
const holdFile = fixtures.writeJson("hold.json", hold)
const release = { operationId: crypto.randomUUID(), expectedRevision: 1, reason: "調査を終えた" }
const releaseFile = fixtures.writeJson("release.json", release)
const erasure = {
  request_id: crypto.randomUUID(),
  template_code: "erasure",
  reason: "本人の依頼",
  target: { kind: "employee", employee_code: "E001" },
}
const erasureFile = fixtures.writeJson("erasure.json", erasure)
const stepUp = ["--step-up", STEP_UP_TOKEN]
const stepUpHeader = { "x-system-step-up": STEP_UP_TOKEN }

describeApiCommands({
  group: "attachments",
  help: attachmentsHelp,
  cases: [
    {
      name: "purge-unlinked",
      argv: ["attachments", "purge-unlinked"],
      expected: { method: "POST", path: "/system/attachments/purge-unlinked" },
    },
    {
      name: "preservations list",
      argv: ["attachments", "preservations", "list", "file-1", "--limit", "10"],
      expected: {
        method: "GET",
        path: "/system/attachments/file-1/preservations",
        query: { limit: "10" },
      },
    },
    {
      name: "preservations create",
      argv: ["attachments", "preservations", "create", "file-1", "--data", holdFile, ...stepUp],
      expected: {
        method: "POST",
        path: "/system/attachments/file-1/preservations",
        headers: stepUpHeader,
        body: hold,
      },
    },
    {
      name: "preservations release",
      argv: [
        "attachments",
        "preservations",
        "release",
        "file-1",
        preservation,
        "--data",
        releaseFile,
        ...stepUp,
      ],
      expected: {
        method: "POST",
        path: `/system/attachments/file-1/preservations/${preservation}/release`,
        headers: stepUpHeader,
        body: release,
      },
    },
  ],
  testedElsewhere: ["show"],
})

describeApiCommands({
  group: "records",
  help: recordsHelp,
  cases: [
    {
      name: "erasure request",
      argv: ["records", "erasure", "request", "--data", erasureFile],
      expected: { method: "POST", path: "/company/personal-data-erasure-requests", body: erasure },
    },
    {
      name: "erasure execute",
      argv: ["records", "erasure", "execute", "12"],
      expected: { method: "POST", path: "/company/personal-data-erasure-requests/12/execute" },
    },
    {
      name: "preserved list",
      argv: [
        "records",
        "preserved",
        "list",
        "--action",
        "read",
        "--purpose",
        "audit",
        "--record-kind",
        "example.record",
      ],
      expected: {
        method: "GET",
        path: "/system/preserved-records",
        query: { action: "read", purpose: "audit", record_kind: "example.record" },
      },
    },
    {
      name: "preserved dossier",
      argv: ["records", "preserved", "dossier", record, "--purpose", "audit"],
      expected: {
        method: "GET",
        path: `/system/preserved-records/${record}/dossier`,
        query: { purpose: "audit" },
      },
    },
    {
      name: "proposals show",
      argv: ["records", "proposals", "show", "41", "2"],
      expected: { method: "GET", path: "/system/proposals/41/versions/2" },
    },
  ],
  testedElsewhere: ["preserved content"],
})

const pdf = () =>
  new Response(new Uint8Array([37, 80, 68, 70]), { headers: { "content-type": "application/pdf" } })

test("attachments show は本文をファイルへ保存し、既存のファイルへは送らずに断る", async () => {
  const output = join(fixtures.directory, "attachment.pdf")

  const saved = await runCliInProcess(["attachments", "show", "file-1", "--output", output], pdf)
  expect({ status: saved.status, path: saved.requests[0]?.path }).toEqual({
    status: 200,
    path: "/api/system/attachments/file-1",
  })
  expect([...(await readFile(output))]).toEqual([37, 80, 68, 70])

  const again = await runCliInProcess(["attachments", "show", "file-1", "--output", output], pdf)
  expect({ status: again.status, count: again.requests.length }).toEqual({ status: 400, count: 0 })
  expect((await runCliInProcess(["attachments", "show", "file-1"])).status).toBe(400)
})

test("records preserved content は開示の目的を送り、本文をファイルへ保存する", async () => {
  const output = join(fixtures.directory, "record.bin")

  const saved = await runCliInProcess(
    [
      "records",
      "preserved",
      "content",
      record,
      "--action",
      "export",
      "--purpose",
      "audit",
      "--format",
      "package",
      "--output",
      output,
    ],
    pdf,
  )
  expect(saved.status).toBe(200)
  expect(saved.requests[0]).toMatchObject({
    method: "GET",
    path: `/api/system/preserved-records/${record}/content`,
    query: { action: "export", purpose: "audit", format: "package" },
  })
  expect((await readFile(output)).byteLength).toBe(4)

  const missing = await runCliInProcess([
    "records",
    "preserved",
    "content",
    record,
    "--output",
    `${output}.2`,
  ])
  expect({ status: missing.status, count: missing.requests.length }).toEqual({
    status: 400,
    count: 0,
  })
})

test("attachments upload はファイルをmultipartで預けてidだけを返す", async () => {
  const file = join(fixtures.directory, "receipt.pdf")
  await writeFile(file, "%PDF")

  const run = await runCliInProcess(["attachments", "upload", "--file", file], () =>
    Response.json({ id: "file-9", status: "pending" }),
  )

  expect(run.status).toBe(200)
  expect(JSON.parse(run.text)).toEqual({ id: "file-9" })
  expect(run.requests[0]).toMatchObject({ method: "POST", path: "/api/system/attachments" })
  expect(String(run.requests[0]?.body)).toContain('filename="receipt.pdf"')
  expect((await runCliInProcess(["attachments", "upload"])).status).toBe(400)
})

test("識別子に . や .. を渡しても別の経路へ送らない", async () => {
  const run = await runCliInProcess(["records", "proposals", "show", "..", "2"])

  expect({ status: run.status, count: run.requests.length }).toEqual({ status: 400, count: 0 })
})
