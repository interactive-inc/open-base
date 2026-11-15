/**
 * モックのアプリの一画面を開き、開発用の橋渡し（window.agent）で部品の状態を読む。
 * 操作を渡すと、その順に実行してから読む。画面を出さないので速く、結果はJSONで返る。
 *
 *   bun run --cwd web dev:mock                                  （別の端末で先に起動する）
 *   bun run --cwd web inspect:mock /decisions/applications/101
 *   bun run --cwd web inspect:mock /path '[{"ref":"理由","action":"setValue","args":["私用"]}]'
 */
import { chromium } from "@playwright/test"

type Step = { ref: string; action: string; args?: ReadonlyArray<unknown> }

const origin = process.env.MOCK_ORIGIN ?? "http://127.0.0.1:18788"
const path = process.argv[2] ?? "/"
const steps: ReadonlyArray<Step> = process.argv[3] === undefined ? [] : JSON.parse(process.argv[3])

const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL ?? "chrome" })
const page = await browser.newPage()
const errors: Array<string> = []
page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text())
})
page.on("pageerror", (error) => errors.push(error.message))
page.on("response", (response) => {
  if (response.status() >= 400) {
    errors.push(
      `${response.status()} ${response.request().method()} ${new URL(response.url()).pathname}`,
    )
  }
})

/** 橋渡しが読み込まれ、画面の読み込み中の表示が終わるまで待つ。 */
async function settle(): Promise<void> {
  await page.waitForFunction(`"agent" in window`, undefined, { timeout: 10_000 })
  await page.waitForLoadState("networkidle")
}

/** 画面の中で評価する式。scriptsの型検査はDOMを知らないので、文字列で渡す。 */
const READ = `({
  url: location.pathname + location.search,
  heading: document.querySelector("h1")?.textContent ?? null,
  alerts: Array.from(document.querySelectorAll('[role="alert"], [role="status"]'), (node) =>
    (node.textContent ?? "").trim(),
  ).filter((text) => text !== ""),
  components: window.agent.snapshot(),
})`

const ACT = `(steps) => window.agent.act({ steps }).then((result) => ({ ok: result.ok, error: result.error ?? null }))`

try {
  await page.goto(origin + path)
  await settle()

  let acted: unknown = null
  if (steps.length > 0) {
    // 送信で画面が移ると実行中の呼び出しは切れる。そのときは移った先を読む。
    acted = await page
      .evaluate(`(${ACT})(${JSON.stringify(steps)})`)
      .catch(() => ({ ok: true, navigated: true }))
    await page.waitForTimeout(300)
    await settle()
  }

  const state = (await page.evaluate(READ)) as Record<string, unknown>
  console.log(JSON.stringify({ acted, ...state, errors }, null, 2))
} catch (error) {
  console.error(
    `画面を開けませんでした。先に bun run --cwd web dev:mock を起動してください。(${String(error)})`,
  )
  process.exitCode = 1
} finally {
  await browser.close()
}
