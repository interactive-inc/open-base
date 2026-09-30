import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test"
import { AuditExportForm } from "@/app/(app)/system/audit-events/_components/audit-export-form"

const fetchMock = vi.fn()
const createObjectUrl = vi.fn(() => "blob:fixture")
const revokeObjectUrl = vi.fn()
const anchorClick = vi.fn()
const OriginalURL = URL

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock)
  class MockURL extends OriginalURL {
    static createObjectURL = createObjectUrl
    static revokeObjectURL = revokeObjectUrl
  }
  vi.stubGlobal("URL", MockURL)
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(anchorClick)
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  fetchMock.mockReset()
  createObjectUrl.mockClear()
  revokeObjectUrl.mockClear()
  anchorClick.mockClear()
})

function renderForm(from = "2026-01-01T00:00:00Z", to = "2026-02-01T00:00:00Z") {
  return render(
    <AuditExportForm
      query={{
        actor_account_id: "12",
        action: "audit.event.read",
        target_type: "audit_event",
        target_id: "evt-001",
        outcome: "succeeded",
        from,
        to,
        limit: "50",
        cursor: "must-not-export",
      }}
    />,
  )
}

describe("AuditExportForm", () => {
  test("downloads an exact thirty-one day CSV with filters but without cursor or limit", async () => {
    fetchMock.mockResolvedValue(
      new Response("event_id\nfixture\n", {
        status: 200,
        headers: { "Content-Type": "text/csv" },
      }),
    )
    renderForm()
    fireEvent.submit(screen.getByRole("button", { name: "CSVを出力" }).closest("form")!)

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce())
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    const parsedUrl = new URL(url, "https://base.example")
    expect(parsedUrl.searchParams.get("actor_account_id")).toBe("12")
    expect(parsedUrl.searchParams.get("action")).toBe("audit.event.read")
    expect(parsedUrl.searchParams.has("cursor")).toBe(false)
    expect(parsedUrl.searchParams.has("limit")).toBe(false)
    expect(options).toMatchObject({ cache: "no-store" })
    await waitFor(() => expect(anchorClick).toHaveBeenCalledOnce())
    expect(createObjectUrl).toHaveBeenCalledOnce()
    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:fixture")
  })

  test("rejects one second over thirty-one days and focuses the end field", () => {
    renderForm("2026-01-01T00:00:00Z", "2026-02-01T00:00:01Z")
    fireEvent.submit(screen.getByRole("button", { name: "CSVを出力" }).closest("form")!)
    expect(screen.getByText("出力期間は31日以内にしてください。")).toBeDefined()
    expect(document.activeElement).toBe(screen.getByLabelText("CSV終了日時"))
    expect(fetchMock).not.toHaveBeenCalled()
  })

  test("shows pending state only while the request is active", async () => {
    let resolveResponse: ((response: Response) => void) | undefined
    fetchMock.mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveResponse = resolve
      }),
    )
    renderForm()
    fireEvent.submit(screen.getByRole("button", { name: "CSVを出力" }).closest("form")!)
    expect(
      (await screen.findByRole("button", { name: "CSVを作成中…" })) as HTMLButtonElement,
    ).toHaveProperty("disabled", true)
    await act(async () => {
      resolveResponse?.(new Response("event_id\n", { status: 200 }))
    })
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "CSVを出力" }) as HTMLButtonElement).toHaveProperty(
        "disabled",
        false,
      ),
    )
  })

  test.each([
    [400, "出力条件を確認してください。"],
    [403, "CSV出力の権限がありません。"],
    [413, "出力期間または条件を狭めてください。"],
    [503, "時間をおいて、もう一度お試しください。"],
  ])("maps status %s to a safe message and keeps the request id", async (status, message) => {
    fetchMock.mockResolvedValue(
      new Response("SQL raw password=fixture", {
        status,
        headers: { "X-Request-ID": "req-fixture" },
      }),
    )
    renderForm()
    fireEvent.submit(screen.getByRole("button", { name: "CSVを出力" }).closest("form")!)
    expect(await screen.findByText(message)).toBeDefined()
    expect(screen.getByText("問い合わせID: req-fixture")).toBeDefined()
    expect(screen.queryByText(/SQL raw password/u)).toBeNull()
  })
})
