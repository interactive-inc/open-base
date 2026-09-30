import { EmptyState } from "@/components/empty-state"
import { GradeRowActions } from "@/app/(app)/company/grades/_components/grade-row-actions"
import { CompanyDefinitionTable } from "@/app/(app)/company/_components/company-definition-table"
import type { GradeResponse } from "@/lib/api/types/grade-types"

type Props = {
  grades: ReadonlyArray<GradeResponse>
  canManage: boolean
}

/** 等級マスタ一覧テーブル。canManage のときだけ各行に変更・取消の操作列を出す。 */
export function GradeList(props: Props) {
  if (props.grades.length === 0) {
    return (
      <EmptyState
        title="等級がありません"
        description="右上の「新規等級」から等級を登録しましょう。"
      />
    )
  }

  return (
    <CompanyDefinitionTable
      canManage={props.canManage}
      definitions={props.grades.map((grade) => ({
        ...grade,
        actions: props.canManage ? <GradeRowActions grade={grade} /> : null,
      }))}
    />
  )
}
