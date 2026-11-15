import { setupServer } from "msw/node"
import { createMockState } from "./seed.ts"
import { createHandlers } from "./handlers.ts"
import type { Scenario } from "./types.ts"

/** 呼び出しごとに独立する。listen / close はテストの所有者が明示する。 */
export function createNodeMock(options: { scenario?: Scenario } = {}) {
  const state = createMockState(options.scenario)
  const server = setupServer(...createHandlers(state))
  return { state, server }
}
