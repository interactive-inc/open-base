import { expect, test } from "bun:test"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { revisionFlag } from "@/lib/input/revision-flag"

const key = "9bf082a7-b4ee-4505-a5d1-f298be9a0663"
const commands = [
  {
    name: "register",
    args: [
      "employees",
      "register",
      "--code",
      "example-employee",
      "--name",
      "Example",
      "--email",
      "you@example.com",
      "--role",
      "member",
      "--hire-on",
      "2026-01-01",
      "--employment-type",
      "FULL_TIME",
      "--password-stdin",
    ],
    flags: ["company-revision"],
  },
  {
    name: "update",
    args: [
      "employees",
      "update",
      "example-employee",
      "--name",
      "Example",
      "--employee-id",
      "example-person",
      "--effective-on",
      "2026-01-01",
      "--idempotency-key",
      key,
      "--reason",
      "example-change",
    ],
    flags: ["company-revision", "person-revision"],
  },
  ...["apply", "request", "correct"].map((name) => ({
    name,
    args: [
      "personnel-actions",
      name,
      "--idempotency-key",
      key,
      ...(name === "correct"
        ? ["--action-id", key, "--reason", "example-correction"]
        : ["--type", "example"]),
    ],
    flags: ["company-revision", "employee-revision", "organization-revision"],
  })),
]

type Command = (typeof commands)[number]

async function execute(command: Command, flag: string, value: string) {
  const directory = await mkdtemp(join(tmpdir(), "base-revision-"))
  const requests = new Array<unknown>()
  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      requests.push(await request.json())
      return Response.json({ ok: true })
    },
  })
  try {
    const file = join(directory, "example.json")
    await writeFile(file, JSON.stringify({ employeeId: "example-employee" }))
    const args = [
      ...command.args,
      ...(command.name === "register" || command.name === "update" ? [] : ["--payload", file]),
    ]
    for (const revision of command.flags)
      args.push(
        `--${revision}=${revision === flag ? value : revision === "person-revision" ? "1" : "0"}`,
      )
    const commandProcess = Bun.spawn(
      [process.execPath, resolve(import.meta.dir, "../../index.ts"), ...args],
      {
        env: { ...process.env, BASE_API: server.url.origin, BASE_CONFIG_DIR: directory },
        stdin: new Blob(["example-password\n"]),
        stdout: "pipe",
        stderr: "pipe",
      },
    )
    const output = await Promise.all([
      commandProcess.exited,
      new Response(commandProcess.stdout).text(),
      new Response(commandProcess.stderr).text(),
    ])
    return { requests, code: output[0], stderr: output[2] }
  } finally {
    await server.stop(true)
    await rm(directory, { recursive: true, force: true })
  }
}

for (const command of commands) {
  for (const flag of command.flags) {
    test(`${command.name}の空の${flag}をAPIへ送信しない`, async () => {
      const result = await execute(command, flag, "")
      expect(result.requests).toEqual([])
      expect(result.code).toBe(1)
    }, 15000)
  }
  test(`${command.name}の正当な版は数値として送信する`, async () => {
    const result = await execute(command, "company-revision", "0002")
    expect(result.code).toBe(0)
    expect(result.requests).toHaveLength(1)
    if (command.name === "update")
      expect(result.requests[0]).toMatchObject({
        profile: { organizationRevision: 2, personRevision: 1 },
      })
    else if (command.name === "register")
      expect(result.requests[0]).toMatchObject({ expected_company_revision: 2 })
    else if (command.name === "request")
      expect(result.requests[0]).toMatchObject({
        base_company_revision: 2,
        base_employee_revision: 0,
        base_organization_revision: 0,
      })
    else
      expect(result.requests[0]).toMatchObject({
        expected_company_revision: 2,
        expected_employee_revision: 0,
        expected_organization_revision: 0,
      })
  }, 15000)
}

for (const value of [" ", "9007199254740993", "0x10", "1e2", "1.0"]) {
  test(`不正な会社版 ${JSON.stringify(value)} をAPIへ送信しない`, async () => {
    const command = commands.find((entry) => entry.name === "apply")
    if (command === undefined) throw new Error("missing fixture")
    const result = await execute(command, "company-revision", value)
    expect(result.requests).toEqual([])
    expect(result.code).toBe(1)
  }, 15000)
}

test("版はsafe integer境界と0を保持し、範囲外を拒否する", () => {
  expect(revisionFlag.parse("0")).toBe(0)
  expect(revisionFlag.parse(String(Number.MAX_SAFE_INTEGER))).toBe(Number.MAX_SAFE_INTEGER)
  for (const value of ["9007199254740992", "-1", "Infinity", "NaN"])
    expect(revisionFlag.safeParse(value).success).toBe(false)
})

test("人物版の0は従来どおり拒否する", async () => {
  const command = commands.find((entry) => entry.name === "update")
  if (command === undefined) throw new Error("missing fixture")
  const result = await execute(command, "person-revision", "0")
  expect(result.requests).toEqual([])
  expect(result.code).toBe(1)
}, 15000)
