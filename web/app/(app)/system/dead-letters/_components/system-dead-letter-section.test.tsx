import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, test, vi } from "vite-plus/test"
import type { SystemDeadLetter } from "@/lib/api/types/system-operation-types"
import { SystemDeadLetterSection } from "@/app/(app)/system/dead-letters/_components/system-dead-letter-section"

const mocks = vi.hoisted(() => ({ getSystemDeadLetters: vi.fn() }))

vi.mock("@/lib/api/get-system-dead-letters", () => ({
  getSystemDeadLetters: mocks.getSystemDeadLetters,
}))
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const pendingDeadLetter: SystemDeadLetter = {
  id: "dead-letter-1",
  sourceType: "job",
  sourceId: "delivery-1",
  payloadDigest: "a".repeat(64),
  reasonCode: "max_attempts_exceeded",
  attempt: 5,
  recordedAt: "2026-04-01T00:00:00.000Z",
  requeuedJobId: null,
  requeuedAt: null,
}

const requeuedDeadLetter: SystemDeadLetter = {
  id: "dead-letter-2",
  sourceType: "outbox",
  sourceId: "delivery-2",
  payloadDigest: "b".repeat(64),
  reasonCode: "external_rejected",
  attempt: 3,
  recordedAt: "2026-04-02T00:00:00.000Z",
  requeuedJobId: "delivery-3",
  requeuedAt: "2026-04-03T00:00:00.000Z",
}

describe("SystemDeadLetterSection", () => {
  test("発生元を日本語にし、未再投入は未と出す", async () => {
    mocks.getSystemDeadLetters.mockResolvedValue([pendingDeadLetter, requeuedDeadLetter])

    render(await SystemDeadLetterSection())

    expect(screen.getByRole("cell", { name: "ジョブ" })).toBeDefined()
    expect(screen.getByRole("cell", { name: "送信箱" })).toBeDefined()
    expect(screen.getByRole("cell", { name: "未" })).toBeDefined()
    expect(screen.getAllByRole("row").slice(1)).toHaveLength(2)
  })

  test("再投入の導線は置かない", async () => {
    mocks.getSystemDeadLetters.mockResolvedValue([pendingDeadLetter])

    render(await SystemDeadLetterSection())

    expect(screen.queryByRole("button")).toBeNull()
  })

  test("1 件も無いときは上限に達した配信が無いことを示す", async () => {
    mocks.getSystemDeadLetters.mockResolvedValue([])

    render(await SystemDeadLetterSection())

    expect(screen.getByText("dead letter がありません")).toBeDefined()
    expect(screen.queryByRole("table")).toBeNull()
  })

  test("取得に失敗したときは行を出さない", async () => {
    mocks.getSystemDeadLetters.mockResolvedValue(new Error("failed"))

    render(await SystemDeadLetterSection())

    expect(screen.getByText("dead letter の取得に失敗しました")).toBeDefined()
    expect(screen.queryByRole("table")).toBeNull()
  })
})
