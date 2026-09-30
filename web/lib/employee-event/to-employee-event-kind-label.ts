/** 異動・在籍イベント種別コードを日本語ラベルへ変換する。未知の値はコードをそのまま返す。 */
export function toEmployeeEventKindLabel(kind: string): string {
  if (kind === "join") {
    return "入社"
  }

  if (kind === "transfer") {
    return "異動"
  }

  if (kind === "leave_of_absence") {
    return "休職"
  }

  if (kind === "return") {
    return "復職"
  }

  if (kind === "retire") {
    return "退職"
  }

  return kind
}
