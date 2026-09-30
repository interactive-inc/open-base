/**
 * 位置引数をパスセグメントに、`--flag value` / `--flag`（boolトグル）を JSON body に変換する。
 * すべてのコマンドは POST でローカル Hono アプリに渡される。
 */
const SHORT_FLAGS: Record<string, string> = {
  h: "help",
  q: "q",
}

export function toRequest(args: string[]) {
  const segments: string[] = []
  const body: Record<string, string> = {}

  let i = 0
  while (i < args.length) {
    const arg = args[i]
    if (arg === undefined) break
    if (arg.startsWith("--")) {
      const key = arg.slice(2)
      const next = args[i + 1]
      if (next !== undefined && (next === "-" || !next.startsWith("-"))) {
        body[key] = next
        i += 2
      } else {
        body[key] = "true"
        i++
      }
      continue
    }
    if (arg.startsWith("-") && arg.length === 2) {
      const short = arg[1]
      const long = short ? SHORT_FLAGS[short] : undefined
      if (long) {
        const next = args[i + 1]
        if (next && !next.startsWith("-")) {
          body[long] = next
          i += 2
        } else {
          body[long] = "true"
          i++
        }
      } else {
        // 未定義の短縮フラグは無視するが、サイレントにせず stderr に警告する。
        process.stderr.write(`警告: 不明なフラグ ${arg} を無視しました\n`)
        i++
      }
      continue
    }
    segments.push(encodeURIComponent(arg))
    i++
  }

  const path = segments.length > 0 ? `/${segments.join("/")}` : "/"
  return { path, url: `http://localhost${path}`, body }
}
