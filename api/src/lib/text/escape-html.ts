/**
 * HTML テンプレートへ差し込む文字列の特殊文字を実体参照へ変換する 。
 * メール本文など、ユーザー由来の値を HTML に埋め込む箇所で使う。
 */
export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}
