/**
 * 業務レコードの ID。
 * API は現在整数 ID を返すが、UUID 移行後は文字列になる。クライアントは両方を受け付ける。
 */
export type EntityId = string | number
