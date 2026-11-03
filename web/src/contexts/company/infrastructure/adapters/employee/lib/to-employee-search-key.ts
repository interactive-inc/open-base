/**
 * 名前の検索で比べる形にそろえる。保存する値は変えず、比べる両側をこの形にしてから比べる。
 *
 * - NFKC で半角カナを全角カナに、全角の英数字を半角にする
 * - ひらがなをカタカナにする
 * - 空白（半角・全角・タブ・改行）を落とし、姓と名の間の空白の有無をそろえる
 * - 英字の大小を同一視する
 */
export function toEmployeeSearchKey(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[ぁ-ゖ]/g, (char) => String.fromCharCode(char.charCodeAt(0) + 0x60))
    .replace(/\s/g, "")
    .toLowerCase()
}
