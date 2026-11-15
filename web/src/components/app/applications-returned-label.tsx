import { Badge } from "@/components/ui/badge"

/** 差し戻された申請に、状態の札と並べて付ける札。申請の状態は承認待ちのまま変わらない。 */
export function ReturnedLabel() {
  return <Badge variant="destructive">差し戻し</Badge>
}
