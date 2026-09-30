import { getCloudflareContext } from "@opennextjs/cloudflare"

/** Web の Worker から API の Worker を呼ぶ service binding の名前。 */
export const API_SERVICE_BINDING = "API_SERVICE"

type ServiceBinding = Readonly<{ fetch: (request: Request) => Promise<Response> }>

function isServiceBinding(value: unknown): value is ServiceBinding {
  return (
    typeof value === "object" &&
    value !== null &&
    "fetch" in value &&
    typeof (value as { fetch: unknown }).fetch === "function"
  )
}

/**
 * Cloudflare の実行環境に API の service binding があれば返す。
 * `next dev`、テスト、binding を設定しない自前の配備では null になり、公開 URL を使う。
 */
function resolveApiServiceBinding(): ServiceBinding | null {
  try {
    const binding: unknown = (getCloudflareContext().env as Record<string, unknown>)[
      API_SERVICE_BINDING
    ]
    return isServiceBinding(binding) ? binding : null
  } catch {
    return null
  }
}

/**
 * サーバー側から API を呼ぶ fetch。service binding があれば公開ネットワークを経由せずに
 * API の Worker を直接呼び、無ければ通常の fetch で `NEXT_PUBLIC_API_URL` へ送る。
 * URL・method・header・body はどちらの経路でも同じものを渡す。
 */
export const apiFetch: typeof fetch = (input, init) => {
  const binding = resolveApiServiceBinding()

  if (binding === null) {
    return fetch(input, init)
  }

  return binding.fetch(new Request(input, init))
}
