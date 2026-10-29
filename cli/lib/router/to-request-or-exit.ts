import { UsageError } from "@/lib/errors"
import { toRequest } from "@/lib/router/router"

/** CLI入口の入力エラーだけを、引数の値やstack traceを含まない診断に変換する。 */
export function toRequestOrExit(args: string[]) {
  try {
    return toRequest(args)
  } catch (error) {
    if (!(error instanceof UsageError)) throw error

    process.stderr.write(`${error.message}\n`)
    process.exit(1)
  }
}
