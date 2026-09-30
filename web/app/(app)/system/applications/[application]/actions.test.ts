import { beforeEach, describe, expect, test, vi } from "vite-plus/test"
import { decideApplicationAction } from "@/app/(app)/system/applications/[application]/actions"

const mocks = vi.hoisted(() => ({
  approvePost: vi.fn(),
  rejectPost: vi.fn(),
  getMe: vi.fn(),
  revalidatePath: vi.fn(),
}))
vi.mock("@/lib/api/get-me", () => ({ getMe: mocks.getMe }))
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }))
vi.mock("@/lib/api/hc-client", () => ({
  createClient: async () => ({
    company: {
      "application-requests": {
        ":id": { approve: { $post: mocks.approvePost }, reject: { $post: mocks.rejectPost } },
      },
    },
  }),
}))

const target = {
  proposal_version: 3,
  proposal_digest: "a".repeat(64),
  task_key: "review",
  task_round: 2,
}
const initial = { ok: false, error: null }

function form(action: string) {
  const body = new FormData()
  body.set("application_id", "42")
  body.set("decision", action)
  body.set("comment", "Reviewed content")
  for (const [key, value] of Object.entries(target)) body.set(key, String(value))
  return body
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.getMe.mockResolvedValue({ permissions: [] })
  mocks.approvePost.mockResolvedValue(Response.json({ status: "approved" }))
  mocks.rejectPost.mockResolvedValue(Response.json({ status: "rejected" }))
})

describe("確認した内容に対するWebの判断", () => {
  test.each(["approve", "reject"])(
    "表示時の版をAPIへ送り、成功時に詳細と一覧を更新する: %s",
    async (action) => {
      expect(await decideApplicationAction(initial, form(action))).toEqual({
        ok: true,
        error: null,
      })
      const called = action === "approve" ? mocks.approvePost : mocks.rejectPost
      expect(called).toHaveBeenCalledWith({
        param: { id: "42" },
        json: { comment: "Reviewed content", decision_target: target },
      })
      expect(mocks.revalidatePath).toHaveBeenCalledWith("/system/applications/42")
    },
  )

  test("古い版の409を成功へ変えず、確認していない最新版へ再送しない", async () => {
    mocks.approvePost.mockResolvedValue(
      Response.json({ error: "application decision target changed" }, { status: 409 }),
    )
    const body = form("approve")
    expect(await decideApplicationAction(initial, body)).toEqual({
      ok: false,
      error: "申請内容または承認段階が更新されています。詳細を再読み込みして確認してください",
    })
    expect(mocks.approvePost).toHaveBeenCalledTimes(1)
    expect(body.get("proposal_version")).toBe("3")
    expect(mocks.revalidatePath).not.toHaveBeenCalled()
  })

  test("参照が欠けたフォームではAPIへ判断を送らない", async () => {
    const body = form("approve")
    body.delete("proposal_digest")
    expect(await decideApplicationAction(initial, body)).toMatchObject({ ok: false })
    expect(mocks.approvePost).not.toHaveBeenCalled()
    expect(mocks.rejectPost).not.toHaveBeenCalled()
  })
})
