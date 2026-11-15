import { addons } from "storybook/preview-api"
import {
  PLAY_FUNCTION_THREW_EXCEPTION,
  STORY_ERRORED,
  STORY_FINISHED,
  STORY_THREW_EXCEPTION,
  UNHANDLED_ERRORS_WHILE_PLAYING,
} from "storybook/internal/core-events"
import type { Preview } from "@storybook/react-vite"
import { withThemeByDataAttribute } from "@storybook/addon-themes"
import { INITIAL_VIEWPORTS } from "storybook/viewport"
import { setupWorker } from "msw/browser"
import { HttpNetworkFrame } from "msw/experimental"
import { createMockState } from "@open-base/mock/seed"
import { createHandlers } from "@open-base/mock/handlers"
import "@/components/globals.css"
import "./preview.css"
import { StandaloneAppShell } from "@/components/app/app-shell"

document.documentElement.lang = "ja"

/** サイドバーを出さない画面。製品では `_layouts/bare.tsx` を使う。 */
const BARE_PAGES = new Set(["Pages/SignIn", "Pages/Enroll", "Pages/Device"])

const worker = setupWorker()
let started: Promise<unknown> | undefined

const preview: Preview = {
  tags: ["autodocs"],
  loaders: [
    async ({ parameters }) => {
      started ??= worker.start({
        quiet: true,
        onUnhandledFrame({ frame, defaults }) {
          if (
            frame instanceof HttpNetworkFrame &&
            new URL(frame.data.request.url).pathname.startsWith("/api/")
          )
            defaults.error()
        },
      })
      await started
      worker.resetHandlers(...createHandlers(createMockState(parameters.mockScenario ?? "admin")))
      return {}
    },
  ],
  decorators: [
    // 製品ではVoidのレイアウトが枠を描く。画面のstoryにはVoidが無いので、同じ枠をここで付ける。
    (Story, context) => {
      if (
        !context.title.startsWith("Pages/") ||
        context.title.startsWith("Pages/Decisions/") ||
        BARE_PAGES.has(context.title)
      )
        return <Story />
      const args = context.args as { email?: string; pathname?: string }
      return (
        <StandaloneAppShell email={args.email ?? "you@example.com"} pathname={args.pathname ?? "/"}>
          <Story />
        </StandaloneAppShell>
      )
    },
    withThemeByDataAttribute({
      themes: { light: "light", dark: "dark" },
      defaultTheme: "light",
      attributeName: "data-theme",
    }),
  ],
  parameters: {
    layout: "centered",
    controls: { expanded: true, matchers: { color: /(background|color)$/i, date: /At$/i } },
    a11y: { test: "error" },
    docs: { codePanel: true, story: { inline: false } },
    viewport: { options: INITIAL_VIEWPORTS },
    backgrounds: {
      options: {
        theme: { name: "テーマの背景", value: "var(--page)" },
        light: { name: "明るい背景", value: "#ffffff" },
        dark: { name: "暗い背景", value: "#171717" },
      },
    },
    options: { storySort: { order: ["Pages", "App", "UI", "Foundations"] } },
  },
  initialGlobals: { backgrounds: { value: "theme" } },
}

export default preview

/**
 * 操作テスト（play）や描画が投げた失敗。storyのidごとに覚えておく。
 * 完了通知の `status` は、playが失敗しても success のまま届くことがあるので、こちらを正とする。
 */
const thrown = new Map<string, string>()
const channel = addons.getChannel()

function message(error: unknown): string {
  if (typeof error === "object" && error !== null && "message" in error) {
    return String(error.message)
  }
  return String(error)
}

function currentStoryId(): string {
  return new URLSearchParams(location.search).get("id") ?? ""
}

for (const event of [PLAY_FUNCTION_THREW_EXCEPTION, STORY_THREW_EXCEPTION, STORY_ERRORED]) {
  channel.on(event, (error: unknown) => thrown.set(currentStoryId(), message(error)))
}
channel.on(UNHANDLED_ERRORS_WHILE_PLAYING, (errors: unknown) =>
  thrown.set(currentStoryId(), Array.isArray(errors) ? errors.map(message).join(" / ") : "error"),
)

// PlaywrightはStorybookの完了通知で、描画・操作・a11yの失敗をまとめて判定する。
channel.on(
  STORY_FINISHED,
  (result: {
    storyId: string
    status: string
    reporters: Array<{
      status: string
      type: string
      result?: {
        violations?: Array<{
          id: string
          nodes: Array<{ target: string[]; failureSummary?: string }>
        }>
        error?: unknown
      }
    }>
  }) => {
    const failedReports = result.reporters.filter((report) => report.status === "failed")
    const playError = thrown.get(result.storyId)
    document.documentElement.dataset.storyId = result.storyId
    document.documentElement.dataset.storyStatus =
      playError !== undefined || failedReports.length > 0 ? "failed" : result.status
    document.documentElement.dataset.storyReports = JSON.stringify([
      ...(playError === undefined ? [] : [{ type: "play", error: playError }]),
      ...failedReports.map((report) => ({
        type: report.type,
        violations: report.result?.violations?.map((violation) => ({
          id: violation.id,
          nodes: violation.nodes.map((node) => ({
            target: node.target,
            summary: node.failureSummary,
          })),
        })),
        error: report.result?.error,
      })),
    ])
  },
)
