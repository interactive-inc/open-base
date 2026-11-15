/// <reference types="vite/client" />
import { createAgent, registerTools } from "@ui-sdk/react/agent"

/**
 * 開発のときだけ使う、画面とエージェントの橋渡し。
 *
 * 画面上のui-sdkの部品の一覧、状態、できる操作を取り出し、直接呼べるようにする。
 * 画面を確かめるとき、スクリーンショットやDOMを読む代わりに `window.agent` を使う。
 * production buildには入らない。本番に出すときは、承認や消去などの操作に
 * `data-agent-confirm` を付け、許す操作を `allow` で絞ってからにする。
 */
const agent = createAgent()

/**
 * ブラウザー内蔵のエージェントへも同じ道具を渡す（WebMCP）。対応していないブラウザーでは何もしない。
 * 読むことと値を入れることは通し、ボタンを押す操作だけは人に確かめる。
 */
const unregister = registerTools(agent, {
  allow: (step) =>
    step.action !== "press" ||
    window.confirm(`エージェントが「${step.label ?? step.ref}」を押します。`),
})

Object.assign(window, { agent })

if (import.meta.hot) {
  import.meta.hot.dispose(() => unregister())
}

export { agent }
