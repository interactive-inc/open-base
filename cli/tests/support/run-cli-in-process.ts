import { spyOn } from "bun:test"
import { app } from "@/app/index"
import { toRequest } from "@/lib/router/router"

export type CapturedApiRequest = {
  method: string
  path: string
  query: Record<string, string>
  headers: Record<string, string>
  body: unknown
}

/**
 * CLIの引数を実際の router で変換して同じprocessのアプリへ渡し、API へ届いた要求を記録する。
 * API は応答関数で置き換えるので、送信しなかった要求は記録に残らない。
 */
export async function runCliInProcess(
  argv: ReadonlyArray<string>,
  respond: () => Response = () => Response.json({ ok: true }),
) {
  const requests: Array<CapturedApiRequest> = []

  const interception = spyOn(globalThis, "fetch").mockImplementation(
    Object.assign(
      async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
        const request = input instanceof Request ? input : new Request(String(input), init)
        const url = new URL(request.url)
        const text = await request.text()
        const isJson = (request.headers.get("content-type") ?? "").includes("application/json")
        requests.push({
          method: request.method,
          path: url.pathname,
          query: Object.fromEntries(url.searchParams),
          headers: Object.fromEntries(request.headers),
          body: text === "" ? null : isJson ? JSON.parse(text) : text,
        })
        return respond()
      },
      { preconnect: fetch.preconnect },
    ),
  )

  try {
    const cli = toRequest([...argv])
    const response = await app.request(cli.url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(cli.body),
    })
    return { status: response.status, text: await response.text(), requests }
  } finally {
    interception.mockRestore()
  }
}
