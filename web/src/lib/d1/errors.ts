/**
 * リポジトリ層が UNIQUE 制約違反を呼び出し側へ伝えるためのエラー。
 * 何らかの一意制約に二重登録が当たったことを表し、application 層は
 * instanceof で素の DB エラーと区別して重複として扱える。
 */
export class UniqueConstraintError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)

    this.name = "UniqueConstraintError"
  }
}
