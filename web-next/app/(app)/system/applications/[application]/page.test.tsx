import { afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test"
import { cleanup, render, screen } from "@testing-library/react"
import ApplicationDetailPage from "@/app/(app)/system/applications/[application]/page"
import { SidebarProvider } from "@/components/ui/sidebar"

const mocks = vi.hoisted(() => ({ getDetail: vi.fn() }))
vi.mock("@/lib/api/get-application-detail", () => ({ getApplicationDetail: mocks.getDetail }))
vi.mock("@/components/back-button", () => ({ BackButton: () => null }))
vi.mock("@/app/(app)/system/applications/[application]/actions", () => ({
  decideApplicationAction: vi.fn(async () => ({ ok: false, error: null })),
}))

const target = {
  proposal_version: 2,
  proposal_digest: "a".repeat(64),
  task_key: "review",
  task_round: 3,
}
const detail = {
  id: 42,
  template_name: "Review",
  template_code: "REVIEW",
  applicant_name: "Applicant",
  status: "pending",
  current_step: "review",
  created_at: "2026-01-01T00:00:00.000Z",
  payload: { reason: "Content actually reviewed" },
  decision_target: target,
  can_decide: true,
  approver_roles: [],
  approvals: [],
  workflow: {
    current_step_key: "review",
    current_round: 3,
    started_at: "2026-01-01T00:00:00.000Z",
    due_at: null,
    returned: false,
    approvals: [],
    steps: [{ key: "review", name: "Review", status: "pending", rejection_behavior: "return" }],
  },
}
beforeEach(() => {
  mocks.getDetail.mockReset()
  mocks.getDetail.mockResolvedValue(detail)
})
afterEach(cleanup)

describe("申請内容と判断フォームの同じsnapshot", () => {
  test("一回の詳細取得で本文・判断対象・差戻しの意味を表示する", async () => {
    const page = await ApplicationDetailPage({ params: Promise.resolve({ application: "42" }) })
    const rendered = render(<SidebarProvider>{page}</SidebarProvider>)
    expect(screen.getByText(/Content actually reviewed/)).toBeTruthy()
    expect(screen.getByRole("button", { name: "差戻し" })).toBeTruthy()
    const form = rendered.container.querySelector("form")
    if (form === null) throw new Error("decision form is missing")
    const body = new FormData(form)
    for (const [key, value] of Object.entries(target)) expect(body.get(key)).toBe(String(value))
    expect(mocks.getDetail).toHaveBeenCalledTimes(1)
    expect(mocks.getDetail).toHaveBeenCalledWith("42")
  })

  test("対象の判断者でない閲覧者には操作を表示しない", async () => {
    mocks.getDetail.mockResolvedValue({ ...detail, can_decide: false })
    const page = await ApplicationDetailPage({ params: Promise.resolve({ application: "42" }) })
    render(<SidebarProvider>{page}</SidebarProvider>)
    expect(screen.getByText(/Content actually reviewed/)).toBeTruthy()
    expect(screen.queryByRole("button", { name: "承認" })).toBeNull()
    expect(screen.queryByRole("button", { name: "差戻し" })).toBeNull()
  })
})
