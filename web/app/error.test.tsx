import { render, screen } from "@testing-library/react"
import { afterEach, describe, expect, test, vi } from "vite-plus/test"
import RootError from "@/app/error"

const mocks = vi.hoisted(() => ({ captureException: vi.fn() }))

vi.mock("@sentry/nextjs", () => ({ captureException: mocks.captureException }))

vi.mock("@/components/login-page", () => ({
  LoginPage: (props: { onAuthenticated: () => void }) => (
    <button type="button" onClick={props.onAuthenticated}>
      LoginPage
    </button>
  ),
}))

afterEach(() => vi.clearAllMocks())

describe("RootError", () => {
  test("renders LoginPage for AuthError without reporting it to Sentry", () => {
    render(
      <RootError
        error={Object.assign(new Error("AUTH_REQUIRED"), { digest: "AUTH_REQUIRED" })}
        reset={vi.fn()}
      />,
    )

    expect(screen.getByRole("button", { name: "LoginPage" })).toBeDefined()
    expect(mocks.captureException).not.toHaveBeenCalled()
  })

  test("reports unexpected errors to Sentry and renders the recovery UI", () => {
    const error = Object.assign(new Error("unexpected"), { digest: "fixture-digest" })

    render(<RootError error={error} reset={vi.fn()} />)

    expect(screen.getByRole("heading", { name: "問題が発生しました" })).toBeDefined()
    expect(mocks.captureException).toHaveBeenCalledWith(error)
  })
})
