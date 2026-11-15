import { delay } from "msw"
import { HttpResponse, http } from "msw/http"
import { areas } from "./areas/index.ts"
import type { MockRequest, MockState } from "./types.ts"

/** 現在のブラウザー画面向け。認証やD1の本番動作の検証には使用しない。 */
export function createHandlers(state: MockState) {
  return [
    http.all("*/api/*", async ({ request }) => {
      if (state.scenario === "slow") await delay(1200)
      const path = new URL(request.url).pathname.slice(4)
      const body =
        request.method === "GET" || request.method === "HEAD"
          ? {}
          : ((await request.json().catch(() => ({}))) as Record<string, unknown>)
      if (path === "/auth/get-session" && request.method === "GET")
        return HttpResponse.json(
          state.signedIn
            ? {
                user: {
                  id: "example-account",
                  email: state.profile.email,
                  name: state.profile.name,
                },
                session: { id: "example-session" },
              }
            : null,
        )
      if (state.scenario === "error")
        return HttpResponse.json({ error: "モックで一時的な失敗を再現しています" }, { status: 503 })
      if (path === "/auth/sign-in/email" && request.method === "POST") {
        if (typeof body.email !== "string" || typeof body.password !== "string" || !body.password)
          return HttpResponse.json({ message: "入力を確認してください" }, { status: 400 })
        state.signedIn = true
        return HttpResponse.json({
          user: { id: "example-account", email: state.profile.email },
          redirect: false,
        })
      }
      if (path === "/auth/sign-out" && request.method === "POST") {
        state.signedIn = false
        return HttpResponse.json({ success: true })
      }
      if (
        [
          "/company/current-profile",
          "/company/inbox/counts",
          "/system/notifications/unread-count",
          "/company/dashboard",
        ].includes(path) &&
        request.method !== "GET"
      )
        return HttpResponse.json({ error: "このモックは読み取り専用です" }, { status: 405 })
      if (!state.signedIn)
        return HttpResponse.json({ error: "サインインしてください" }, { status: 401 })
      if (path === "/company/current-profile")
        return state.scenario === "unlinked"
          ? HttpResponse.json({ error: "従業員と未連携です" }, { status: 403 })
          : HttpResponse.json(state.profile)
      if (path === "/company/inbox/counts")
        return HttpResponse.json({ applications: state.applications })
      if (path === "/system/notifications/unread-count")
        return HttpResponse.json({
          unread_count: state.notifications.filter((item) => !item.read).length,
        })
      if (path === "/company/dashboard")
        return state.profile.permissions.includes("dashboard:view")
          ? HttpResponse.json(state.dashboard)
          : HttpResponse.json({ error: "表示する権限がありません" }, { status: 403 })
      const application = handleApplications(state, path, request.method, body)
      if (application !== null) return application
      for (const area of areas) {
        const response = await area.handle({
          state: state.areas[area.name],
          root: state,
          path,
          method: request.method,
          query: new URL(request.url).searchParams,
          body,
        })
        if (response !== null) return response
      }
      if (path === "/auth/device" && request.method === "GET") {
        const code = new URL(request.url).searchParams.get("user_code") ?? ""
        return state.devices[code]
          ? HttpResponse.json({ userCode: code, status: state.devices[code] })
          : HttpResponse.json({ message: "コードが無効です" }, { status: 400 })
      }
      if (
        ["/auth/device/approve", "/auth/device/deny"].includes(path) &&
        request.method === "POST"
      ) {
        const code = typeof body.userCode === "string" ? body.userCode : ""
        if (state.devices[code] !== "pending")
          return HttpResponse.json({ message: "コードが無効または使用済みです" }, { status: 409 })
        state.devices[code] = path.endsWith("approve") ? "approved" : "denied"
        return HttpResponse.json({ success: true })
      }
      if (path.startsWith("/auth/passkey/") || path.startsWith("/auth/sign-in/passkey"))
        return HttpResponse.json(
          { message: "モックでは実パスキーを登録・検証しません" },
          { status: 501 },
        )
      return HttpResponse.json(
        { error: `未定義のモック: ${request.method} ${path}` },
        { status: 501 },
      )
    }),
  ]
}

/**
 * 申請テンプレートの読み書きと、申請の提出・承認・却下・変更・取り下げ・出し直し。該当しない経路はnullを返す。
 * 一覧の絞り込みや承認ワークフローなど、クエリや領域の状態が要る経路は申請の領域が返す。
 */
function handleApplications(
  state: MockState,
  path: string,
  method: string,
  body: Record<string, unknown>,
) {
  type Area = import("./areas/applications.ts").State
  type Item = import("./areas/applications.ts").ApplicationRequest
  // 保存済みの古い状態には領域の値が無いことがある。足りない分を空で補う。
  const area = (state.areas.applications ??= {}) as Area
  area.requests ??= []
  area.approverRoles ??= {}
  area.workflows ??= {}
  const requests = (): Item[] => [...state.requests, ...area.requests]
  const fail = (status: number, error: string, code?: string) =>
    HttpResponse.json(code === undefined ? { error } : { error, code }, { status })
  const manager = state.scenario !== "member"
  const templateName = (code: string) =>
    state.templates.find((template) => template.code === code)?.name ?? code
  const returnedStep = (item: Item) => item.steps.find((step) => step.status === "returned")
  const currentStep = (item: Item) => {
    const returned = returnedStep(item)
    if (returned !== undefined) return `returned:${returned.key}`
    return item.steps.find((step) => step.status === "pending")?.key ?? null
  }
  const detail = (item: Item) => ({
    id: item.id,
    decision_target: {
      proposal_version: 1,
      proposal_digest: "0".repeat(64),
      task_key: item.steps.find((step) => step.status === "pending")?.key ?? "done",
      task_round: 1,
    },
    can_decide: item.canDecide && item.status === "pending",
    template_code: item.templateCode,
    template_name: templateName(item.templateCode),
    applicant_name: item.applicantName,
    status: item.status,
    current_step: currentStep(item),
    payload: item.payload,
    created_at: item.createdAt,
    workflow:
      item.steps.length === 0
        ? null
        : {
            due_at: null,
            returned: returnedStep(item) !== undefined,
            steps: item.steps,
            approvals: item.decisions.map((decision) => ({
              ...decision,
              round: 1,
              represented_approver_name: decision.approver_name,
            })),
          },
  })
  const readTemplateBody = () => {
    const schema = body.schema_json as { fields?: unknown } | null | undefined
    const roles = body.approver_roles
    if (
      typeof body.name !== "string" ||
      body.name.trim() === "" ||
      typeof body.category !== "string" ||
      body.category.trim() === "" ||
      typeof schema !== "object" ||
      schema === null ||
      !Array.isArray(schema.fields) ||
      (roles !== undefined &&
        (!Array.isArray(roles) || roles.some((role) => typeof role !== "string")))
    )
      return null
    return {
      name: body.name,
      category: body.category,
      description: typeof body.description === "string" ? body.description : null,
      schema_json: schema as MockState["templates"][number]["schema_json"],
      approver_roles: (roles ?? []) as string[],
    }
  }
  const templateDetail = (template: MockState["templates"][number]) => ({
    ...template,
    approver_roles: area.approverRoles[template.code] ?? [],
  })

  if (path === "/company/application-templates" && method === "GET")
    return HttpResponse.json({
      data: state.templates.map(({ schema_json: _, ...rest }) => rest),
      total: state.templates.length,
    })
  if (path === "/company/application-templates" && method === "POST") {
    if (!manager) return fail(403, "この操作をする権限がありません", "forbidden")
    const input = readTemplateBody()
    const code = typeof body.code === "string" ? body.code : ""
    if (input === null || code === "") return fail(400, "入力を確認してください")
    if (state.templates.some((template) => template.code === code))
      return fail(409, "同じコードのテンプレートがあります", "template_code_conflict")
    const { approver_roles, ...template } = input
    state.templates.push({ code, ...template })
    area.approverRoles[code] = approver_roles
    return HttpResponse.json(
      { id: state.templates.length, ...templateDetail(state.templates.at(-1)!) },
      { status: 201 },
    )
  }
  const templateMatch = /^\/company\/application-templates\/([^/]+)$/.exec(path)
  if (templateMatch !== null) {
    const code = decodeURIComponent(templateMatch[1] ?? "")
    const index = state.templates.findIndex((item) => item.code === code)
    if (index === -1) return fail(404, "見つかりません", "not_found")
    const template = state.templates[index]!
    if (method === "GET") return HttpResponse.json(templateDetail(template))
    if (!manager) return fail(403, "この操作をする権限がありません", "forbidden")
    if (method === "PUT") {
      const input = readTemplateBody()
      if (input === null) return fail(400, "入力を確認してください")
      const { approver_roles, ...rest } = input
      state.templates[index] = { code, ...rest }
      area.approverRoles[code] = approver_roles
      return HttpResponse.json({ id: index + 1, ...templateDetail(state.templates[index]!) })
    }
    if (method === "DELETE") {
      if (requests().some((item) => item.templateCode === code))
        return fail(409, "申請に使われています", "template_in_use")
      state.templates.splice(index, 1)
      delete area.workflows[code]
      return new HttpResponse(null, { status: 204 })
    }
    return fail(405, "このモックでは扱いません")
  }
  if (path === "/company/application-requests/inbox" && method === "GET") {
    const data = requests()
      .filter((item) => item.canDecide && item.status === "pending")
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    return HttpResponse.json({
      data: data.map((item) => ({
        id: item.id,
        template_name: templateName(item.templateCode),
        applicant_name: item.applicantName,
        current_step: currentStep(item),
        status: item.status,
        created_at: item.createdAt,
      })),
      total: data.length,
    })
  }
  if (path === "/company/application-requests/me" && method === "GET") {
    const data = requests()
      .filter((item) => item.mine)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    return HttpResponse.json({
      data: data.map((item) => ({
        id: item.id,
        template_id: 1,
        template_name: templateName(item.templateCode),
        status: item.status,
        current_step: currentStep(item),
        payload: item.payload,
        created_at: item.createdAt,
      })),
      total: data.length,
    })
  }
  if (path === "/company/application-requests" && method === "POST") {
    const template = state.templates.find((item) => item.code === body.template_code)
    const payload = body.payload
    if (!template || typeof payload !== "object" || payload === null)
      return fail(400, "入力を確認してください")
    const values = payload as Record<string, string | number>
    if (template.schema_json.fields.some((field) => field.required && !(field.id in values)))
      return fail(400, "必須の項目がありません")
    const created: MockRequest = {
      id: Math.max(100, ...requests().map((item) => item.id)) + 1,
      templateCode: template.code,
      applicantName: state.profile.name,
      mine: true,
      canDecide: false,
      status: "pending",
      payload: values,
      createdAt: new Date(Date.UTC(2026, 10, 14, 1)).toISOString(),
      steps: [{ key: "manager", name: "上長", status: "pending" }],
      decisions: [],
    }
    state.requests.push(created)
    return HttpResponse.json(detail(created), { status: 201 })
  }
  const match = /^\/company\/application-requests\/(\d+)(\/approve|\/reject|\/resubmit)?$/.exec(
    path,
  )
  if (match === null) return null
  const item = requests().find((candidate) => candidate.id === Number(match[1]))
  if (!item) return fail(404, "見つかりません", "not_found")
  const payload =
    typeof body.payload === "object" && body.payload !== null && !Array.isArray(body.payload)
      ? (body.payload as Record<string, string | number>)
      : null
  if (match[2] === undefined) {
    if (method === "GET") return HttpResponse.json(detail(item))
    if (method !== "PUT" && method !== "DELETE") return fail(405, "このモックでは扱いません")
    if (!item.mine) return fail(403, "申請した人だけが操作できます", "forbidden")
    if (item.status !== "pending") return fail(409, "すでに決まっています", "not_pending")
    if (method === "DELETE") {
      state.requests = state.requests.filter((candidate) => candidate.id !== item.id)
      area.requests = area.requests.filter((candidate) => candidate.id !== item.id)
      return new HttpResponse(null, { status: 204 })
    }
    if (item.steps.length > 0)
      return fail(409, "ワークフローのある申請は差し戻しのときだけ直せます", "workflow_locked")
    if (payload === null) return fail(400, "入力を確認してください")
    item.payload = payload
    return HttpResponse.json({ id: item.id, status: item.status, payload })
  }
  if (method !== "POST") return fail(405, "このモックでは扱いません")
  if (match[2] === "/resubmit") {
    if (!item.mine) return fail(403, "申請した人だけが操作できます", "forbidden")
    if (returnedStep(item) === undefined) return fail(409, "差し戻されていません", "not_returned")
    if (payload === null) return fail(400, "入力を確認してください")
    item.payload = payload
    item.steps = item.steps.map((step, index) => ({
      ...step,
      status: index === 0 ? "pending" : "waiting",
    }))
    return HttpResponse.json({
      id: item.id,
      status: item.status,
      current_step: currentStep(item),
      payload,
    })
  }
  const step = item.steps.find((candidate) => candidate.status === "pending")
  if (!item.canDecide || item.status !== "pending" || !step)
    return fail(409, "判断できません", "conflict")
  const approve = match[2] === "/approve"
  const comment = typeof body.comment === "string" && body.comment !== "" ? body.comment : null
  if (!approve && comment === null) return fail(400, "却下にはコメントが必須です")
  step.status = approve ? "approved" : "rejected"
  const next = approve ? item.steps.find((candidate) => candidate.status === "waiting") : undefined
  if (next) next.status = "pending"
  else item.status = approve ? "approved" : "rejected"
  // 次の段階は別の人の番になるので、本人の判断待ちからは外れる。
  item.canDecide = false
  item.decisions.push({
    id: item.decisions.length + 100,
    step_key: step.key,
    approver_name: state.profile.name,
    action: approve ? "approve" : "reject",
    comment,
    created_at: new Date(Date.UTC(2026, 10, 14, 2)).toISOString(),
  })
  state.applications = requests().filter(
    (candidate) => candidate.canDecide && candidate.status === "pending",
  ).length
  return HttpResponse.json({ status: item.status })
}
