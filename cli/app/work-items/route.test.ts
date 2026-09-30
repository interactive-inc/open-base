import { afterAll, beforeAll, expect, spyOn, test } from "bun:test"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { app } from "@/app/index"

const originalConfig = process.env.BASE_CONFIG_DIR
const directory = mkdtempSync(join(tmpdir(), "system-work-cli-"))
beforeAll(() => {
  process.env.BASE_CONFIG_DIR = directory
})
afterAll(() => {
  if (originalConfig === undefined) delete process.env.BASE_CONFIG_DIR
  else process.env.BASE_CONFIG_DIR = originalConfig
  rmSync(directory, { recursive: true, force: true })
})
const id = "00000000-0000-4000-8000-000000000001"
function request(path: string, body: unknown) {
  return app.request(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}
function capture(response: () => Response = () => Response.json({ ok: true })) {
  const requests: Request[] = []
  const interception = spyOn(globalThis, "fetch").mockImplementation(
    Object.assign(
      async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
        requests.push(
          input instanceof Request ? new Request(input, init) : new Request(String(input), init),
        )
        return response()
      },
      { preconnect: fetch.preconnect },
    ),
  )
  return { requests, interception }
}
test("CLIの保存では確認済み成果・版・再送キーと再認証headerを維持する", async () => {
  const command = {
    commandId: crypto.randomUUID(),
    expectedRevision: 3,
    reason: "内容を確認した",
    resultId: crypto.randomUUID(),
    resultDigest: "a".repeat(64),
  }
  const path = join(directory, "approved.json")
  writeFileSync(path, JSON.stringify(command))
  const captured = capture(() => Response.json({ error: "work_item_conflict" }, { status: 409 }))
  try {
    const response = await request(`/work-items/approve/${id}`, {
      data: path,
      "step-up": "b".repeat(64),
    })
    expect(response.status).toBe(409)
    expect(captured.requests).toHaveLength(1)
    expect(new URL(captured.requests[0]?.url ?? "http://localhost").pathname).toBe(
      `/system/work-items/${id}/approve`,
    )
    expect(captured.requests[0]?.headers.get("x-system-step-up")).toBe("b".repeat(64))
    expect(await captured.requests[0]?.json()).toEqual(command)
  } finally {
    captured.interception.mockRestore()
  }
})
test("再認証や確認済みJSONを欠く判断と無効な操作ではAPIを呼ばない", async () => {
  const path = join(directory, "invalid.json")
  writeFileSync(path, JSON.stringify({ reason: "確認" }))
  const captured = capture()
  try {
    expect((await request(`/work-items/approve/${id}`, { data: path })).status).toBe(400)
    expect(
      (await request(`/work-items/approve/${id}`, { data: path, "step-up": "b".repeat(64) }))
        .status,
    ).toBe(400)
    expect((await request(`/work-items/unknown/${id}`, {})).status).toBe(400)
    expect(captured.requests).toHaveLength(0)
  } finally {
    captured.interception.mockRestore()
  }
})
test("一覧と履歴のcursorをAPIへ渡し、証拠のバイト列を上書きせず保存する", async () => {
  const captured = capture(
    () =>
      new Response(new Uint8Array([0, 128, 255]), {
        headers: { "content-type": "application/pdf" },
      }),
  )
  try {
    expect((await request(`/work-items/history/${id}`, { after: "3", limit: "10" })).status).toBe(
      200,
    )
    expect(new URL(captured.requests[0]?.url ?? "http://localhost").searchParams.get("after")).toBe(
      "3",
    )
    const output = join(directory, "evidence.pdf")
    expect(
      (await request(`/work-items/evidence/${id}`, { "attachment-id": "evidence", output })).status,
    ).toBe(200)
    expect([...readFileSync(output)]).toEqual([0, 128, 255])
    writeFileSync(output, "保存済み")
    expect(
      (await request(`/work-items/evidence/${id}`, { "attachment-id": "evidence", output })).status,
    ).toBe(400)
    expect(readFileSync(output, "utf8")).toBe("保存済み")
  } finally {
    captured.interception.mockRestore()
  }
})
test("CLIのhelpに成果確認と責任引き継ぎの操作が載る", async () => {
  const response = await request("/work-items", { help: "1" })
  expect(response.status).toBe(200)
  expect(await response.text()).toContain("--step-up")
})
