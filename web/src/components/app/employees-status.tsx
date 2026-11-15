import { Badge } from "@/components/ui/badge"
import type {
  DirectoryStatus,
  LifecycleEventDisplayStatus,
  LifecycleStatus,
  PersonnelActionRequestStatus,
} from "@/components/app/employees-types"

/** 札の文言と重み。注意が要るものだけ `destructive` にし、色だけに頼らず文字で伝える。 */
type Look = { text: string; variant: "secondary" | "outline" | "destructive" }

const EMPLOYEE_STATUS: Readonly<Record<DirectoryStatus | LifecycleStatus, Look>> = {
  active: { text: "在籍", variant: "secondary" },
  leave: { text: "休職中", variant: "destructive" },
  retired: { text: "退職", variant: "outline" },
  inactive: { text: "雇用なし", variant: "outline" },
  prehire: { text: "入社前", variant: "outline" },
}

const EVENT_STATUS: Readonly<Record<LifecycleEventDisplayStatus, Look>> = {
  confirmed: { text: "確定", variant: "outline" },
  scheduled: { text: "予定", variant: "secondary" },
  corrected: { text: "訂正済み", variant: "destructive" },
  correction: { text: "訂正", variant: "destructive" },
}

const REQUEST_STATUS: Readonly<Record<PersonnelActionRequestStatus, Look>> = {
  pending: { text: "承認待ち", variant: "secondary" },
  approved: { text: "承認済み", variant: "outline" },
  rejected: { text: "却下", variant: "destructive" },
  withdrawn: { text: "取り下げ", variant: "outline" },
}

/** 従業員の在籍の状態を短い札で見せる。 */
export function EmployeeStatusLabel({ status }: { status: DirectoryStatus | LifecycleStatus }) {
  const look = EMPLOYEE_STATUS[status]
  return <Badge variant={look.variant}>{look.text}</Badge>
}

/** 人事発令が確定・予定・訂正のどれかを短い札で見せる。 */
export function EventStatusLabel({ status }: { status: LifecycleEventDisplayStatus }) {
  const look = EVENT_STATUS[status]
  return <Badge variant={look.variant}>{look.text}</Badge>
}

/** 人事発令の申請の状態を短い札で見せる。 */
export function RequestStatusLabel({ status }: { status: PersonnelActionRequestStatus }) {
  const look = REQUEST_STATUS[status]
  return <Badge variant={look.variant}>{look.text}</Badge>
}
