import { StatusLabel } from "@/components/status-label"

type Props = {
  status: string
}

/** 従業員ステータスを日本語ラベル + 配色付き StatusLabel で表示する。 */
export function EmployeeStatusBadge(props: Props) {
  const label = toStatusLabel(props.status)

  const variant = toStatusVariant(props.status)

  return <StatusLabel variant={variant}>{label}</StatusLabel>
}

/** status コードを日本語ラベルに変換する。未知の値はそのまま返す。 */
function toStatusLabel(status: string): string {
  if (status === "active") {
    return "在籍"
  }

  if (status === "leave") {
    return "休職"
  }

  if (status === "retired") {
    return "退職"
  }

  if (status === "prehire") return "入社予定"

  return status
}

/** status コードを StatusLabel のバリアントに対応づける。退職だけ destructive にする。 */
function toStatusVariant(status: string): "secondary" | "destructive" {
  if (status === "retired") {
    return "destructive"
  }

  return "secondary"
}
