import type { MockState, Scenario } from "../types.ts"

/** 一つの要求。`state` はこの領域だけの状態、`root` は全体の状態（本人のprofileなど）。 */
export type MockAreaRequest<S> = {
  state: S
  root: MockState
  /** `/api` を除いた経路。 */
  path: string
  method: string
  query: URLSearchParams
  body: Record<string, unknown>
}

/**
 * 機能の領域ごとのモック。領域は自分の状態と経路だけを持つ。
 * `handle` は自分の経路でなければnullを返し、次の領域へ渡す。
 */
export type MockArea<S> = {
  name: string
  seed: (scenario: Scenario) => S
  handle: (request: MockAreaRequest<S>) => Response | null | Promise<Response | null>
}

/** 領域を定義する。型を合わせるためだけの関数。 */
export function defineMockArea<S>(area: MockArea<S>): MockArea<S> {
  return area
}
