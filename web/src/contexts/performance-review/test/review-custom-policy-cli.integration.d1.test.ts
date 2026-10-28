import { expect, setDefaultTimeout, test } from "bun:test"
import { rejects } from "node:assert/strict"
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { resolve, join } from "node:path"
import { z } from "zod"
import { reviewHttpFixture } from "@/contexts/performance-review/test/review-http.test-support"
import { createCliTestClient } from "../../../../../cli/tests/support/cli-test-client"
import { createMcpTestClient } from "../../../../../mcp/tests/support/mcp-test-client"

setDefaultTimeout(60000)
const decision = z.object({
  revision: z.number(),
  decision_target: z.object({
    proposal_version: z.number(),
    proposal_digest: z.string(),
    task_key: z.string(),
    task_round: z.number(),
  }),
})

test("独自の尺度と区分配分をCLIとMCPで作成・提出・承認し、制度と集計結果を履歴に保つ", async () => {
  const fixture = await reviewHttpFixture()
  const directory = await mkdtemp(join(tmpdir(), "review-policy-"))
  const tokens = ["review-owner", "review-first", "review-second"]
  const server = Bun.serve({
    port: 0,
    fetch(request) {
      const token = request.headers.get("authorization")?.replace(/^Bearer /, "")
      const index = tokens.indexOf(token ?? "")
      const url = new URL(request.url)
      return fixture.call(
        index < 0 ? null : index,
        url.pathname.replace(/^\/api(?=\/)/, "") + url.search,
        {
          method: request.method,
          headers: request.headers,
          body: request.body,
          duplex: "half",
        } as RequestInit,
      )
    },
  })
  const clients: Array<Awaited<ReturnType<typeof createMcpTestClient>>> = []
  try {
    for (const [index, token] of tokens.entries()) {
      const folder = join(directory, String(index))
      await mkdir(folder)
      await writeFile(
        join(folder, "settings.json"),
        JSON.stringify({
          endpoints: {
            [server.url.toString()]: {
              accessToken: token,
              email: `review-${index}@example.com`,
              name: "Review participant",
            },
          },
        }),
      )
    }
    const owner = createCliTestClient({
      entry: resolve(import.meta.dir, "../../../../../cli/index.ts"),
      baseUrl: server.url.toString(),
      configDirectory: join(directory, "0"),
    })
    const reviewer = createCliTestClient({
      entry: resolve(import.meta.dir, "../../../../../cli/index.ts"),
      baseUrl: server.url.toString(),
      configDirectory: join(directory, "1"),
    })
    const finalReviewer = await createMcpTestClient({
      entry: resolve(import.meta.dir, "../../../../../mcp/index.ts"),
      baseUrl: server.url.toString(),
      configDirectory: join(directory, "2"),
    })
    clients.push(finalReviewer)
    const file = async (name: string, body: unknown) => {
      const path = join(directory, name + ".json")
      await writeFile(path, JSON.stringify(body))
      return path
    }
    const cycleId = crypto.randomUUID()
    const sheetId = crypto.randomUUID()
    const policy = {
      version: 1,
      scale: [
        { value: 1, label: "改善" },
        { value: 3, label: "標準" },
        { value: 7, label: "期待超過" },
      ],
      sections: [
        { key: "mbo", name: "目標", weight: 70 },
        { key: "behavior", name: "行動", weight: 30 },
      ],
    }
    const period = await file("period", {
      id: cycleId,
      name: "上期",
      starts_on: "2026-04-01",
      ends_on: "2026-09-30",
      evaluation_policy: policy,
      goal_workflow: fixture.workflow,
      evaluation_workflow: fixture.workflow,
      reason: "制度を固定",
    })
    const key = crypto.randomUUID()
    const created = await owner([
      "reviews",
      "cycles",
      "create",
      "--data",
      period,
      "--idempotency-key",
      key,
    ])
    expect(created.code, created.stderr).toBe(0)
    expect(JSON.parse(created.stdout)).toMatchObject({ evaluation_policy: policy })
    expect(
      (await owner(["reviews", "cycles", "create", "--data", period, "--idempotency-key", key]))
        .stdout,
    ).toBe(created.stdout)
    const behavior = {
      id: crypto.randomUUID(),
      title: "行動目標",
      success_criteria: "確認可能な行動",
      weight: 100,
      section_key: "behavior",
    }
    const sheet = await file("sheet", {
      id: sheetId,
      cycle_id: cycleId,
      goals: [fixture.goal, behavior],
      reason: "目標を設定",
    })
    expect(
      (
        await owner([
          "reviews",
          "sheets",
          "create",
          "--data",
          sheet,
          "--idempotency-key",
          crypto.randomUUID(),
        ])
      ).code,
    ).toBe(0)
    await rejects(
      fixture.database
        .prepare(
          "UPDATE performance_review_sheets SET revision = revision + 1, snapshot_json = json_set(snapshot_json, '$.revision', revision + 1, '$.evaluation_policy.sections[0].weight', 60) WHERE id = ?",
        )
        .bind(sheetId)
        .run(),
      /review_sheet_revision_conflict/,
    )
    const submit = await file("submit", { expected_revision: 1, reason: "目標を提出" })
    expect(
      (
        await owner([
          "reviews",
          "sheets",
          "submit-goals",
          sheetId,
          "--data",
          submit,
          "--idempotency-key",
          crypto.randomUUID(),
        ])
      ).code,
    ).toBe(0)
    const firstTarget = decision.parse(
      JSON.parse((await reviewer(["reviews", "sheets", "show", sheetId])).stdout),
    )
    const approval = await file("approval", {
      expected_revision: firstTarget.revision,
      target: firstTarget.decision_target,
      reason: "目標を確認",
    })
    expect(
      (
        await reviewer([
          "reviews",
          "sheets",
          "approve",
          sheetId,
          "--data",
          approval,
          "--idempotency-key",
          crypto.randomUUID(),
        ])
      ).code,
    ).toBe(0)
    const finalTarget = decision.parse(
      JSON.parse((await owner(["reviews", "sheets", "show", sheetId])).stdout),
    )
    expect(
      (
        await finalReviewer.callTool({
          name: "review_sheets_command",
          arguments: {
            sheet_id: sheetId,
            idempotency_key: crypto.randomUUID(),
            command: {
              operation: "decide",
              action: "approve",
              expected_revision: finalTarget.revision,
              target: finalTarget.decision_target,
              reason: "目標を確認",
            },
          },
        })
      ).isError,
    ).not.toBe(true)
    const assessments = [
      { goal_id: fixture.goal.id, score: 7, actual: "実績", comment: "根拠" },
      { goal_id: behavior.id, score: 3, actual: "行動の実績", comment: "根拠" },
    ]
    const invalid = await file("invalid-score", {
      expected_revision: 4,
      reason: "自己評価",
      assessments: assessments.map((value) => ({ ...value, score: 5 })),
    })
    expect(
      (
        await owner([
          "reviews",
          "sheets",
          "self-evaluate",
          sheetId,
          "--data",
          invalid,
          "--idempotency-key",
          crypto.randomUUID(),
        ])
      ).code,
    ).toBe(1)
    const self = await file("self", { expected_revision: 4, reason: "自己評価", assessments })
    expect(
      (
        await owner([
          "reviews",
          "sheets",
          "self-evaluate",
          sheetId,
          "--data",
          self,
          "--idempotency-key",
          crypto.randomUUID(),
        ])
      ).code,
    ).toBe(0)
    expect(JSON.parse((await owner(["reviews", "sheets", "show", sheetId])).stdout)).toMatchObject({
      revision: 5,
      self_evaluation_summary: { weighted_score: 5.8, normalized_score: 80 },
    })
    const evaluation = await file("evaluation", { expected_revision: 5, reason: "評価を提出" })
    expect(
      (
        await owner([
          "reviews",
          "sheets",
          "submit-evaluation",
          sheetId,
          "--data",
          evaluation,
          "--idempotency-key",
          crypto.randomUUID(),
        ])
      ).code,
    ).toBe(0)
    const rated = [
      { goal_id: fixture.goal.id, score: 3, comment: "確認した根拠" },
      { goal_id: behavior.id, score: 7, comment: "確認した根拠" },
    ]
    const target = decision.parse(
      JSON.parse((await reviewer(["reviews", "sheets", "show", sheetId])).stdout),
    )
    const rating = await file("rating", {
      expected_revision: target.revision,
      target: target.decision_target,
      reason: "評価を確認",
      assessments: rated,
    })
    expect(
      (
        await reviewer([
          "reviews",
          "sheets",
          "approve",
          sheetId,
          "--data",
          rating,
          "--idempotency-key",
          crypto.randomUUID(),
        ])
      ).code,
    ).toBe(0)
    const last = decision.parse(
      JSON.parse((await owner(["reviews", "sheets", "show", sheetId])).stdout),
    )
    expect(
      (
        await finalReviewer.callTool({
          name: "review_sheets_command",
          arguments: {
            sheet_id: sheetId,
            idempotency_key: crypto.randomUUID(),
            command: {
              operation: "decide",
              action: "approve",
              expected_revision: last.revision,
              target: last.decision_target,
              reason: "評価を確定",
              assessments: rated,
            },
          },
        })
      ).isError,
    ).not.toBe(true)
    const history = JSON.parse((await owner(["reviews", "sheets", "history", sheetId])).stdout)
    expect(history.data).toHaveLength(8)
    expect(history.data.at(-1)).toMatchObject({
      snapshot: { status: "finalized", evaluation_policy: policy },
      detail: { evaluation_summary: { weighted_score: 4.2, normalized_score: 53.33 } },
    })
  } finally {
    for (const client of clients) await client.close()
    await server.stop(true)
    await rm(directory, { recursive: true, force: true })
  }
})
