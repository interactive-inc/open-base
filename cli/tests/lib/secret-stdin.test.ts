import { expect, test } from "bun:test"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { createCliTestClient } from "@/tests/support/cli-test-client"

type Received = { method: string; path: string; stepUp: string | null; body: unknown }

const issued = "c".repeat(64)
const stepUp = "d".repeat(64)
/** 偽のAPIと実CLIを用意し、届いた要求を記録しながら試験を実行する。 */
async function withFakeApi(
  check: (
    cli: (
      arguments_: ReadonlyArray<string>,
      stdin?: string,
    ) => ReturnType<ReturnType<typeof createCliTestClient>>,
    received: ReadonlyArray<Received>,
    directory: string,
  ) => Promise<void>,
) {
  const directory = await mkdtemp(join(tmpdir(), "secret-stdin-cli-"))
  const received: Array<Received> = []
  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      const text = await request.text()
      received.push({
        method: request.method,
        path: new URL(request.url).pathname,
        stepUp: request.headers.get("x-system-step-up"),
        body: text === "" ? null : JSON.parse(text),
      })
      return Response.json({ step_up_token: issued, method: "password", expires_at: "2026-01-01" })
    },
  })
  const run = createCliTestClient({
    entry: resolve(import.meta.dir, "../../index.ts"),
    baseUrl: server.url.toString(),
    configDirectory: directory,
  })
  try {
    await check((arguments_, stdin) => run(arguments_, stdin ?? null), received, directory)
  } finally {
    await server.stop(true)
    await rm(directory, { recursive: true, force: true })
  }
}

test(
  "step-up はパスワードを標準入力から送り、トークンだけを出力する",
  () =>
    withFakeApi(async (cli, received) => {
      const password = await cli(["step-up", "--password-stdin"], "example-password\n")
      const external = await cli(
        ["step-up", "--external-identity-token-stdin"],
        "header.payload.sig",
      )

      expect([
        password.code,
        password.stdout.trim(),
        external.code,
        external.stdout.trim(),
      ]).toEqual([0, issued, 0, issued])
      expect(received).toEqual([
        {
          method: "POST",
          path: "/api/system/step-up-grants",
          stepUp: null,
          body: { method: "password", password: "example-password" },
        },
        {
          method: "POST",
          path: "/api/system/step-up-grants",
          stepUp: null,
          body: { method: "external_identity", token: "header.payload.sig" },
        },
      ])
    }),
  30_000,
)

test(
  "step-up は方式が一つでないときと標準入力が空のときに送らない",
  () =>
    withFakeApi(async (cli, received) => {
      const none = await cli(["step-up"], "example-password")
      const both = await cli(
        ["step-up", "--password-stdin", "--external-identity-token-stdin"],
        "example-password",
      )
      const empty = await cli(["step-up", "--password-stdin"], "")

      expect([none.code, both.code, empty.code]).toEqual([1, 1, 1])
      expect(received).toEqual([])
    }),
  30_000,
)

test(
  "accounts password set は標準入力のパスワードを再認証つきで送る",
  () =>
    withFakeApi(async (cli, received) => {
      const set = await cli(
        ["accounts", "password", "set", "account-1", "--password-stdin", "--step-up", stepUp],
        "example-password-long\n",
      )
      const withoutStepUp = await cli(
        ["accounts", "password", "set", "account-1", "--password-stdin"],
        "example-password-long",
      )
      const withoutStdin = await cli([
        "accounts",
        "password",
        "set",
        "account-1",
        "--step-up",
        stepUp,
      ])

      expect([set.code, withoutStepUp.code, withoutStdin.code]).toEqual([0, 1, 1])
      expect(received).toEqual([
        {
          method: "PATCH",
          path: "/api/system/accounts/account-1/password-credentials",
          stepUp,
          body: { password: "example-password-long" },
        },
      ])
    }),
  30_000,
)

test(
  "accounts identities create はパスワードを標準入力だけで受け、JSONに書けば送らない",
  () =>
    withFakeApi(async (cli, received, directory) => {
      const identity = join(directory, "identity.json")
      await writeFile(identity, JSON.stringify({ provider: "password", email: "you@example.com" }))
      const leaked = join(directory, "leaked.json")
      await writeFile(
        leaked,
        JSON.stringify({
          provider: "password",
          email: "you@example.com",
          password: "x".repeat(12),
        }),
      )

      const created = await cli(
        [
          "accounts",
          "identities",
          "create",
          "account-1",
          "--data",
          identity,
          "--password-stdin",
          "--step-up",
          stepUp,
        ],
        "example-password-long",
      )
      const rejected = await cli([
        "accounts",
        "identities",
        "create",
        "account-1",
        "--data",
        leaked,
        "--step-up",
        stepUp,
      ])

      expect([created.code, rejected.code]).toEqual([0, 1])
      expect(received).toEqual([
        {
          method: "POST",
          path: "/api/system/accounts/account-1/identities",
          stepUp,
          body: {
            provider: "password",
            email: "you@example.com",
            password: "example-password-long",
          },
        },
      ])
    }),
  30_000,
)
