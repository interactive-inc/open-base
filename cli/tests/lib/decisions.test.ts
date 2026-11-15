import { expect, test } from "bun:test"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { createCliTestClient } from "@/tests/support/cli-test-client"

/** 承認・却下・差し戻しは人がブラウザーで行う。CLIは判断の画面のURLを示すだけでAPIを呼ばない。 */
test("判断はAPIへ送らず、判断の画面のURLを案内する", async () => {
  const directory = await mkdtemp(join(tmpdir(), "decision-cli-"))
  const requests: string[] = []
  const server = Bun.serve({
    port: 0,
    fetch(request) {
      requests.push(new URL(request.url).pathname)
      return Response.json({ status: "ok" })
    },
  })
  const origin = server.url.origin
  const run = createCliTestClient({
    entry: resolve(import.meta.dir, "../../index.ts"),
    baseUrl: server.url.toString(),
    configDirectory: directory,
  })
  try {
    const application = await run(["application-requests", "decide", "12"])
    expect(application).toMatchObject({ code: 0 })
    expect(application.stdout).toBe(
      `${origin}/decisions/applications/12\nブラウザーで開いて判断してください。\n`,
    )
    expect((await run(["application-requests", "decide"])).code).toBe(1)
    expect((await run(["application-requests", "decide", "../1"])).code).toBe(1)
    expect((await run(["application-requests", "decide", "1", "--comment", "ok"])).code).toBe(1)

    const id = crypto.randomUUID()
    const sheet = await run(["reviews", "sheets", "decide", id])
    expect(sheet).toMatchObject({ code: 0 })
    expect(sheet.stdout).toBe(
      `${origin}/decisions/reviews/${id}\nブラウザーで開いて判断してください。\n`,
    )
    expect((await run(["reviews", "sheets", "decide", "bad-id"])).code).toBe(1)
    expect((await run(["reviews", "cycles", "decide", id])).code).toBe(1)

    // 廃止したコマンドと、commandでのdecideはAPIへ送らない。
    const file = join(directory, "decide.json")
    await writeFile(
      file,
      JSON.stringify({
        operation: "decide",
        action: "approve",
        expected_revision: 2,
        reason: "確認",
      }),
    )
    const key = crypto.randomUUID()
    const command = await run([
      "reviews",
      "sheets",
      "command",
      id,
      "--data",
      file,
      "--idempotency-key",
      key,
    ])
    expect(command.code).toBe(1)
    expect(command.stderr).toContain(`${origin}/decisions/reviews/${id}`)
    for (const action of ["approve", "return", "reject"]) {
      const result = await run([
        "reviews",
        "sheets",
        action,
        id,
        "--data",
        file,
        "--idempotency-key",
        key,
      ])
      expect(result.code).toBe(1)
    }
    for (const action of ["approve", "reject"]) {
      // 未知のコマンドは親のhelpへ戻り、APIへは送らない。
      const result = await run(["application-requests", action, "12", "--comment", "ok"])
      expect(result.stdout).not.toContain("approved")
      expect(result.stdout).not.toContain("rejected")
    }
    expect(requests).toEqual([])
  } finally {
    await server.stop(true)
    await rm(directory, { recursive: true, force: true })
  }
}, 30000)
