import { expect, test } from "bun:test"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

test("bootstrap does not rotate an existing session when its password is rejected", async () => {
  const directory = await mkdtemp(join(tmpdir(), "base-bootstrap-session-"))
  const requests: { path: string; method: string; authorization: string | null }[] = []
  const server = Bun.serve({
    port: 0,
    fetch(request) {
      const path = new URL(request.url).pathname
      requests.push({
        path,
        method: request.method,
        authorization: request.headers.get("authorization"),
      })
      if (path === "/system/bootstrap")
        return Response.json({ error: "already_initialized" }, { status: 409 })
      if (request.method === "PATCH")
        return Response.json({ access_token: "rotated-access", refresh_token: "rotated-refresh" })
      return Response.json({ error: "invalid_credentials" }, { status: 401 })
    },
  })
  const baseUrl = server.url.toString().replace(/\/$/, "")
  const settingsFile = join(directory, "settings.json")
  const initial = JSON.stringify({
    endpoints: {
      [baseUrl]: {
        accessToken: "saved-access",
        refreshToken: "saved-refresh",
        email: "you@example.com",
        name: "Example",
      },
    },
  })
  const companyFile = join(directory, "company.json")
  await writeFile(settingsFile, initial)
  await writeFile(
    companyFile,
    JSON.stringify({
      name: "Example",
      code: "example",
      organization_name: "Example organization",
      representative_name: "Example representative",
      initial_responsibilities: [],
      hire_date: "2026-01-01",
      employment_type: "FULL_TIME",
      locale: "en",
      time_zone: "UTC",
      fiscal_year_start_month: 1,
      reason: "Initialize confirmed company",
    }),
  )
  try {
    const command = Bun.spawn(
      [
        process.execPath,
        resolve(import.meta.dir, "../../index.ts"),
        "bootstrap",
        "--email",
        "you@example.com",
        "--password",
        "example-password",
        "--token",
        "example-bootstrap-token",
        "--company-data",
        companyFile,
        "--idempotency-key",
        crypto.randomUUID(),
      ],
      {
        env: { ...process.env, BASE_API: baseUrl, BASE_CONFIG_DIR: directory },
        stdout: "pipe",
        stderr: "pipe",
      },
    )
    const output = await Promise.all([
      command.exited,
      new Response(command.stdout).text(),
      new Response(command.stderr).text(),
    ])
    expect(output[0]).toBe(1)
    expect(output[2]).toContain("ERR 401")
    expect(requests).toEqual([
      { path: "/system/bootstrap", method: "POST", authorization: null },
      { path: "/system/sessions", method: "POST", authorization: null },
    ])
    expect(await readFile(settingsFile, "utf8")).toBe(initial)
  } finally {
    server.stop(true)
    await rm(directory, { recursive: true, force: true })
  }
}, 15_000)
