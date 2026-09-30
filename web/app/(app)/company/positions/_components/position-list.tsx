import { EmptyState } from "@/components/empty-state"
import { PositionRowActions } from "@/app/(app)/company/positions/_components/position-row-actions"
import { CompanyDefinitionTable } from "@/app/(app)/company/_components/company-definition-table"
import type { PositionResponse } from "@/lib/api/types/position-types"

type Props = {
  positions: ReadonlyArray<PositionResponse>
  canManage: boolean
}

/** 役職マスタ一覧テーブル。canManage のときだけ各行に変更・取消の操作列を出す。 */
export function PositionList(props: Props) {
  if (props.positions.length === 0) {
    return (
      <EmptyState
        title="役職がありません"
        description="右上の「新規役職」から役職を登録しましょう。"
      />
    )
  }

  return (
    <CompanyDefinitionTable
      canManage={props.canManage}
      definitions={props.positions.map((position) => ({
        ...position,
        actions: props.canManage ? <PositionRowActions position={position} /> : null,
      }))}
    />
  )
}
