import { getEmployeeGradeHistory } from "@/lib/api/get-employee-grade-history"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EmployeeGradeHistoryTable } from "@/app/(app)/company/employees/[employee]/_components/employee-grade-history-table"

type Props = { code: string }
const recordedTime = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "UTC",
  dateStyle: "medium",
  timeStyle: "long",
})

/** 確定した等級割当の改訂と、保全した旧付与の原記録を区別する。 */
export async function EmployeeGradeHistory(props: Props) {
  const history = await getEmployeeGradeHistory(props.code)
  if (history instanceof Error) return <p role="status">等級履歴を読み込めませんでした。</p>
  return (
    <Card>
      <CardHeader>
        <CardTitle>等級履歴</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <p>等級の割り当て</p>
          {history.revisions.length === 0 ? (
            <p>等級の割り当てはありません。</p>
          ) : (
            <EmployeeGradeHistoryTable
              label="等級の割り当て履歴"
              columns={["有効期間", "等級ID・雇用ID", "変更ID・版・状態", "記録者・理由・記録日時"]}
              rows={history.revisions.map((revision) => ({
                key: `${revision.id}:${revision.revision}`,
                cells: [
                  `${revision.effectiveFrom} 〜 ${revision.effectiveTo ?? "終了日なし"}`,
                  `${revision.gradeId} / ${revision.employmentId}`,
                  `${revision.id} / ${revision.revision} / ${revision.state === "void" ? "取消" : "有効"}`,
                  `${revision.actorAccountId} / ${revision.reason} / ${recordedTime.format(revision.recordedAt)}`,
                ],
              }))}
            />
          )}
          <p>以前の等級記録</p>
          {history.archive === null ? (
            <p role="status">
              以前の等級記録は保存されていないため表示できません。記録がなかったとは限りません。
            </p>
          ) : (
            <>
              <p>
                保存日：{history.archive.observedOn}
                。等級名は保存した時点のもので、付与した当時の名称と異なる場合があります。
              </p>
              {history.archive.source.awards.length === 0 ? (
                <p>以前の等級記録はありません。</p>
              ) : (
                <EmployeeGradeHistoryTable
                  label="以前の等級記録"
                  columns={["適用日", "等級ID・名称（保存時点）", "理由・作成日時"]}
                  rows={history.archive.source.awards.map((award) => ({
                    key: String(award.id),
                    cells: [
                      award.effectiveDate,
                      `#${award.gradeId} / ${award.observedDefinition?.name ?? "名称不明"}`,
                      `${award.reason ?? "理由不明"} / ${award.createdAt}`,
                    ],
                  }))}
                />
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
