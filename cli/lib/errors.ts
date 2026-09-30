import { HTTPException } from "hono/http-exception"

/**
 * 引数・フラグの不足や形式誤りなど、コマンドの使い方の誤り。
 * CLI レイヤーのエラー群は HTTPException を継承するので routes/index.ts の onError に乗り、
 * 最終的に stderr へ出力され exit 1 になる
 */
export class UsageError extends HTTPException {
  constructor(message: string) {
    super(400, { message })
  }
}

/** 入力ファイルが読めない・JSON として解析できない。 */
export class InputError extends HTTPException {
  constructor(message: string) {
    super(400, { message })
  }
}

/** API がエラー応答を返した（4xx/5xx をそのまま伝える）。 */
export class ApiError extends HTTPException {
  constructor(status: number, message: string) {
    super(status as 400, { message })
  }
}
