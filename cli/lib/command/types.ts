/**
 * 一つのCLIコマンドが呼ぶAPIの経路と、送信前にそろえる入力。
 * 入力の形の正しさはAPIが判定し、CLIは必須の引数・ヘッダーの有無と秘密の受け取り方だけを決める。
 */
export type ApiCommand = {
  summary: string
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
  /** `:name` を位置引数で順に埋める。 */
  path: string
  /** CLIのフラグ名からクエリ名への対応。 */
  query?: Readonly<Record<string, string>>
  /** 省略できないクエリのフラグ名。 */
  requiredQuery?: ReadonlyArray<string>
  /** `--data` のJSON objectを本文として送る。 */
  data?: "required" | "optional"
  /** 直前の本人確認（`--step-up`）を要求する。 */
  stepUp?: true
  /** `--idempotency-key` を `Idempotency-Key` ヘッダーで送る。 */
  idempotencyKey?: true
  /**
   * Companyの会社を指定する方法。
   * flag は `--organization-id` をヘッダーへ送る。
   * data は確認済みJSONの organizationId と expectedRevision をヘッダー（if-match）へ移し、残りを本文にする。
   */
  organization?: "flag" | "data"
  /** 標準入力から読む秘密を本文の項目へ入れる。秘密はフラグの値やJSONファイルで受けない。 */
  secret?: { flag: string; field: string; required: boolean }
  /** 応答の本文を `--output` のファイルへ保存する。 */
  download?: true
}

/** 一つのトップレベルコマンド群。コマンド名は空白区切りの語で、位置引数の前に置く。 */
export type ApiCommandGroup = {
  name: string
  summary: string
  /** 位置引数もサブコマンドも無いときに実行するコマンド名。null ならhelpを表示する。 */
  defaultCommand: string | null
  notes: string
  commands: Readonly<Record<string, ApiCommand>>
}
