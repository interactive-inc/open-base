import { describe, expect, test } from "vite-plus/test"
import { toResponseError } from "@/lib/api/to-response-error"

describe("APIの競合理由を画面へ伝える", () => {
  test("Companyのproblem応答から再確認の案内を保持する", async () => {
    const response = Response.json(
      {
        type: "/problems/personnel_action_stale",
        code: "personnel_action_stale",
        status: 409,
        detail: "一覧を再読み込みして内容を確認してください",
      },
      { status: 409, headers: { "content-type": "application/problem+json" } },
    )
    const error = await toResponseError(response, { fallback: "変更に失敗しました" })
    expect(error.message).toBe("変更に失敗しました（一覧を再読み込みして内容を確認してください）")
  })
  test("従来のerror応答と個別の日本語への変換を維持する", async () => {
    const error = await toResponseError(Response.json({ error: "conflict" }, { status: 409 }), {
      fallback: "変更に失敗しました",
      conflictMessages: { conflict: "内容を再確認してください" },
    })
    expect(error.message).toBe("内容を再確認してください")
  })
  test.each([null, [], { detail: 123 }, { detail: { message: "invalid" } }])(
    "不正な応答では既定の案内を返す: %j",
    async (body) => {
      expect(
        (
          await toResponseError(Response.json(body, { status: 409 }), {
            fallback: "変更に失敗しました",
          })
        ).message,
      ).toBe("変更に失敗しました")
    },
  )
  test("サーバー障害のdetailを利用者の画面へ出さない", async () => {
    expect(
      (
        await toResponseError(Response.json({ detail: "internal diagnostic" }, { status: 503 }), {
          fallback: "変更に失敗しました",
        })
      ).message,
    ).toBe("変更に失敗しました")
  })
})
