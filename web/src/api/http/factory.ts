import type { HonoEnv } from "@/bindings"
import { createFactory } from "hono/factory"

export const factory = createFactory<HonoEnv>()
