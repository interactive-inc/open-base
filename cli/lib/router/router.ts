import { UsageError } from "@/lib/errors"
import { parseFlag } from "@/lib/router/parse-flag"

/**
 * 位置引数をパスセグメントに、値付きflagと定義済みtoggleをJSON bodyに変換する。
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
      const flag = parseFlag(arg.slice(2), args[i + 1])
      if (flag.value === null) delete body[flag.key]
      else body[flag.key] = flag.value
      i += flag.consumed
      continue
    }
    if (arg.startsWith("-") && arg.length === 2) {
      const short = arg[1]
      const long = short ? SHORT_FLAGS[short] : undefined
      if (long) {
        const flag = parseFlag(long, args[i + 1])
        if (flag.value === null) delete body[flag.key]
        else body[flag.key] = flag.value
        i += flag.consumed
      } else {
        // 未定義の短縮フラグは無視するが、サイレントにせず stderr に警告する。
        process.stderr.write(`警告: 不明なフラグ ${arg} を無視しました\n`)
        i++
      }
      continue
    }
    if (arg === "" || arg === "." || arg === "..")
      throw new UsageError("空文字・単独の . と .. は位置引数に指定できません")
    segments.push(encodeURIComponent(arg))
    i++
  }

  const path = segments.length > 0 ? `/${segments.join("/")}` : "/"
  return { path, url: `http://localhost${path}`, body }
}
