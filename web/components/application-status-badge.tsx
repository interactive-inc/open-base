import { StatusLabel } from "@/components/status-label"
import type { ApplicationStatus } from "@/lib/api/types/application-types"

type Props = {
  status: ApplicationStatus
  returned?: boolean
}

/** 申請ステータスを日本語ラベルの StatusLabel で表示する。却下・失効だけ destructive にし、他は secondary に揃える。 */
export function ApplicationStatusBadge(props: Props) {
  if (props.returned === true) {
    return <StatusLabel>差戻し</StatusLabel>
  }

  if (props.status === "approved") {
    return <StatusLabel>承認済み</StatusLabel>
  }

  if (props.status === "rejected") {
    return <StatusLabel variant="destructive">却下</StatusLabel>
  }

  return <StatusLabel>承認待ち</StatusLabel>
}
