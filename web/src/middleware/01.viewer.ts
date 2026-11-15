import { defineMiddleware } from "void"
import { getUser } from "void/auth"
import { readCurrentProfile } from "@/api/http/page-readers"
import type { PageApiJson } from "@/api/http/void-api-route"

/** 枠が表示名に使う、本人のprofileの一部。 */
type ViewerProfile = { name: string }

/** 画面の枠が使う、サインインしている本人。サインイン前は `null`。 */
export type Viewer = { email: string; profile: PageApiJson<ViewerProfile> }

declare module "void" {
  interface CloudContextVariables {
    shared: { viewer: Viewer | null }
  }
}

/** 画面ではない要求。APIと、Voidや静的ファイルの経路。 */
function isPageRequest(method: string, path: string): boolean {
  if (method !== "GET") return false
  if (path.startsWith("/api/") || path.startsWith("/__void")) return false
  return !/\.[a-z0-9]+$/i.test(path)
}

/**
 * 画面を開く要求に、本人の情報を共有データとして付ける。
 * レイアウトがこれを読んで枠（サイドバーと表示名）を描くので、各画面は枠を描かない。
 * profileはAPIと同じ認可を通して読む。読めないときも画面は開けるよう、失敗は状態として渡す。
 */
export default defineMiddleware(async (c, next) => {
  if (isPageRequest(c.req.method, c.req.path)) {
    const user = getUser()
    if (user === null) {
      c.set("shared", { viewer: null })
    } else {
      const profile = await readCurrentProfile<ViewerProfile>(c).catch(
        (): PageApiJson<ViewerProfile> => ({ kind: "error" }),
      )
      // 共有データは全画面へ渡るので、枠に要る氏名だけを載せる。
      c.set("shared", {
        viewer: {
          email: user.email,
          profile:
            profile.kind === "ok" ? { kind: "ok", data: { name: profile.data.name } } : profile,
        },
      })
    }
  }
  await next()
})
