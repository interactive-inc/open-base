/** /system/health */
import { createFactory } from "hono/factory"

const factory = createFactory()

// @authorization public - versioned health checkは認証前に到達できてよい
export const GET = factory.createHandlers((context) => context.json({ status: "ok" }, 200))
