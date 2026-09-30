import { factory } from "@/api/http/factory"
import { schema } from "@/schema"
import { drizzle } from "drizzle-orm/d1"

/**
 * c.var.database に Drizzle のクライアントを設定する。
 * 本番は Cloudflare D1。テストは env.DB に bun:sqlite ベースの D1 互換を注入する。
 */
export const databaseMiddleware = factory.createMiddleware((c, next) => {
  c.set("database", drizzle(c.env.DB, { schema }))

  return next()
})
