import type { MockNotification, Scenario } from "../types.ts"
import { defineMockArea } from "./area.ts"

type Reference = { type: string; id: string }

/** 共通の通知（`root.notifications`）に無い、APIの一件が持つ項目。 */
type Detail = {
  kind: string
  body: string | null
  source: Reference | null
  priority: "low" | "normal" | "high" | "critical"
}

/** この領域の架空の状態。既読と一覧の正本は `root.notifications` に置き、ここは足りない項目だけを持つ。 */
export type State = {
  details: Record<string, Detail>
  /** 既読にした日時。共通の状態は既読かどうかしか持たないので、ここで覚える。 */
  readAt: Record<string, string>
}

const DEFAULT_DETAIL: Detail = {
  kind: "company:announcement",
  body: null,
  source: null,
  priority: "normal",
}

/** Companyが出す通知の出所。`id` は業務の名前と番号のJSON。 */
function companySource(domain: string, id: number | null): Reference {
  return { type: "company:notification.source", id: JSON.stringify({ domain, id }) }
}

/** 共通のseedが作る通知の題名ごとに、種類と本文を決める。題名は三種類を順に繰り返す。 */
function detailFor(index: number): Detail {
  switch (index % 3) {
    case 0:
      return {
        kind: "company:approval_request",
        body: "Example 休暇の申請が届きました。内容を確かめて、承認か却下をしてください。",
        source: companySource("application_request", 101),
        priority: index === 0 ? "high" : "normal",
      }
    case 1:
      return {
        kind: "company:announcement",
        body: "Example 部署の名前が変わりました。\n新しい組織図は組織の画面で確かめられます。",
        source: companySource("manual", null),
        priority: "normal",
      }
    default:
      return {
        kind: "company:approval_result",
        body: null,
        source: companySource("application_request", 104),
        priority: "normal",
      }
  }
}

function seed(scenario: Scenario): State {
  if (scenario === "empty") return { details: {}, readAt: {} }
  return {
    details: Object.fromEntries(
      Array.from({ length: 24 }, (_, i) => [`notification-${i + 1}`, detailFor(i)]),
    ),
    readAt: {},
  }
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status })
}

const NOT_FOUND = { code: "not_found", error: "通知が見つかりません" }
const INVALID = { code: "invalid_request", error: "入力を確認してください" }

export const area = defineMockArea<State>({
  name: "notifications",
  seed,
  handle: ({ state, root, path, method, query, body }) => {
    if (path !== "/system/notifications" && !path.startsWith("/system/notifications/")) return null

    /** APIの一件の形にする。 */
    const toApi = (item: MockNotification) => {
      const detail = state.details[item.id] ?? DEFAULT_DETAIL
      return {
        id: item.id,
        message_id: `message-${item.id}`,
        kind: detail.kind,
        title: item.title,
        body: detail.body,
        source: detail.source,
        action: null,
        resource_scope: null,
        priority: detail.priority,
        delivered_at: item.createdAt,
        read_at: item.read ? (state.readAt[item.id] ?? item.createdAt) : null,
      }
    }
    const markRead = (item: MockNotification, at: string) => {
      if (item.read) return
      item.read = true
      state.readAt[item.id] = at
    }

    if (path === "/system/notifications/unread-count" && method === "GET")
      return json({ unread_count: root.notifications.filter((item) => !item.read).length })

    if (path === "/system/notifications" && method === "GET") {
      const read = query.get("read")
      const limit = Number(query.get("limit") ?? "20")
      const offset = Number(query.get("offset") ?? "0")
      if (
        (read !== null && read !== "true" && read !== "false") ||
        !Number.isInteger(limit) ||
        limit < 1 ||
        limit > 100 ||
        !Number.isInteger(offset) ||
        offset < 0 ||
        offset > 10_000
      )
        return json(INVALID, 400)
      const matched = root.notifications
        .filter((item) => read === null || item.read === (read === "true"))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      return json({
        notifications: matched.slice(offset, offset + limit).map(toApi),
        total: matched.length,
        limit,
        offset,
      })
    }

    if (path === "/system/notifications" && method === "PATCH") {
      if (body.read !== true) return json(INVALID, 400)
      const now = new Date().toISOString()
      const unread = root.notifications.filter((item) => !item.read)
      for (const item of unread) markRead(item, now)
      return json({ marked_count: unread.length })
    }

    const id = decodeURIComponent(path.slice("/system/notifications/".length))
    if (id === "" || id.includes("/")) return null
    const index = root.notifications.findIndex((item) => item.id === id)
    const item = root.notifications[index]

    if (method === "GET") return item === undefined ? json(NOT_FOUND, 404) : json(toApi(item))
    if (method === "PATCH") {
      if (body.read !== true) return json(INVALID, 400)
      if (item === undefined) return json(NOT_FOUND, 404)
      markRead(item, new Date().toISOString())
      return json({ id: item.id, read_at: toApi(item).read_at })
    }
    if (method === "DELETE") {
      if (item === undefined) return json(NOT_FOUND, 404)
      root.notifications.splice(index, 1)
      return new Response(null, { status: 204 })
    }
    return null
  },
})
