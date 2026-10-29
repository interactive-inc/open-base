import { expect, test } from "bun:test"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

async function execute(operation: string, session: unknown) {
  const directory = await mkdtemp(join(tmpdir(), "base-session-response-"))
  const requests = new Array<string>()
  const server = Bun.serve({
    port: 0,
    fetch(request) {
      const path = new URL(request.url).pathname
      requests.push(request.method + " " + path)
      if (path === "/system/bootstrap") return new Response(null, { status: 409 })
      if (path === "/system/sessions") return Response.json(session)
      if (path === "/company/bootstrap")
        return Response.json({
          account_id: "example-account",
          employee_id: "example-employee",
          organization_revision: 1,
          replayed: false,
        })
      return Response.json({ name: "Example" })
    },
  })
  const file = join(directory, "settings.json")
  const initial = JSON.stringify({
    endpoints: {
      [server.url.origin]: {
        accessToken: "saved-access",
        refreshToken: "saved-refresh",
        email: "saved@example.com",
        name: "Example",
      },
    },
  })
  try {
    await writeFile(file, initial)
    const declaration = join(directory, "company.json")
    await writeFile(
      declaration,
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
        reason: "Confirmed initial organization",
      }),
    )
    const command = Bun.spawn(
      [
        process.execPath,
        resolve(import.meta.dir, "../../index.ts"),
        operation,
        "--email",
        "you@example.com",
        "--password",
        "example-password",
        ...(operation === "bootstrap"
          ? [
              "--company-data",
              declaration,
              "--idempotency-key",
              "9bf082a7-b4ee-4505-a5d1-f298be9a0663",
              "--token",
              "example-bootstrap",
            ]
          : []),
      ],
      {
        env: { ...process.env, BASE_API: server.url.origin, BASE_CONFIG_DIR: directory },
        stdout: "pipe",
        stderr: "pipe",
      },
    )
    const output = await Promise.all([
      command.exited,
      new Response(command.stdout).text(),
      new Response(command.stderr).text(),
    ])
    return { code: output[0], stored: await readFile(file, "utf8"), initial, requests }
  } finally {
    await server.stop(true)
    await rm(directory, { recursive: true, force: true })
  }
}

for (const operation of ["login", "bootstrap"]) {
  for (const session of [
    { account_id: "example-account", access_token: "", refresh_token: "example-refresh" },
    { account_id: "example-account", access_token: "example-access", refresh_token: "" },
  ]) {
    test(`${operation}は空tokenを保存せず後続APIへ進まない ${JSON.stringify(session)}`, async () => {
      const result = await execute(operation, session)
      expect(result.stored).toBe(result.initial)
      expect(result.code).toBe(1)
      expect(result.requests).toEqual(
        operation === "bootstrap"
          ? ["POST /system/bootstrap", "POST /system/sessions"]
          : ["POST /system/sessions"],
      )
    }, 15000)
  }
  for (const refreshToken of [null, "example-rotated"]) {
    test(`${operation}は正当なtoken対を保存する ${JSON.stringify(refreshToken)}`, async () => {
      const result = await execute(operation, {
        account_id: "example-account",
        access_token: "example-access",
        refresh_token: refreshToken,
      })
      expect(result.code).toBe(0)
      expect(result.stored).toContain('"accessToken": "example-access"')
      expect(result.stored).toContain('"refreshToken": ' + JSON.stringify(refreshToken ?? ""))
    }, 15000)
  }
}
