#!/usr/bin/env bun
import { toRequest } from "@/lib/router/router"
import { helpText } from "@/lib/help-text"
import { app } from "@/app"

const args = process.argv.slice(2)

if (args.length === 0) {
  process.stdout.write(`${helpText}\n`)
  process.exit(0)
}

const { path, url, body } = toRequest(args)

// ルート直下の help はトップヘルプを返す
if (body.help !== undefined && path === "/") {
  process.stdout.write(`${helpText}\n`)
  process.exit(0)
}

const res = await app.request(url, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
})

/**
 * 未知のコマンドは、親パスの help にフォールバックする。
 * ただしハンドラに到達して投げられた 404（マーカーヘッダ付き）は本物のエラーなので
 * フォールバックせず stderr + exit 1 に落とす。
 */
const isHandlerError = res.headers.get("x-base-handler-error") === "1"

if (!res.ok && res.status === 404 && !isHandlerError) {
  const segments = path.split("/").filter(Boolean)
  for (let depth = segments.length - 1; depth >= 1; depth--) {
    const parentPath = `/${segments.slice(0, depth).join("/")}`
    const helpRes = await app.request(`http://localhost${parentPath}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ help: "true" }),
    })
    if (helpRes.ok) {
      process.stdout.write(`${await helpRes.text()}\n`)
      process.exit(0)
    }
  }
  process.stdout.write(`${helpText}\n`)
  process.exit(0)
}

const contentType = res.headers.get("content-type") ?? ""
const isJson = contentType.includes("application/json")
const responseBody = isJson ? JSON.stringify(await res.json(), null, 2) : await res.text()

if (!res.ok) {
  if (responseBody) process.stderr.write(`${responseBody}\n`)
  process.exit(1)
}

if (responseBody) process.stdout.write(`${responseBody}\n`)
