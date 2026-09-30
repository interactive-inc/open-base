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
  if (history instanceof Error)
    return (
      <p role="status">
        等級履歴を取得できませんでした。閲覧権限と会社情報の接続状況を確認してください。
      </p>
    )
  return (
    <Card>
      <CardHeader>
        <CardTitle>等級履歴</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <p>確定した等級割当（会社版 {history.companyRevision}）</p>
          {history.revisions.length === 0 ? (
            <p>この会社版に確定した等級割当はありません。</p>
          ) : (
            <EmployeeGradeHistoryTable
              label="確定した等級割当の改訂"
              columns={["有効期間", "等級ID・雇用ID", "改訂・状態", "記録者・理由"]}
              rows={history.revisions.map((revision) => ({
                key: `${revision.id}:${revision.revision}`,
                cells: [
                  `${revision.effectiveFrom} 〜 ${revision.effectiveTo ?? "終了日なし"}`,
                  `${revision.gradeId} / ${revision.employmentId}`,
                  `${revision.id} / ${revision.revision} / ${revision.state === "void" ? "取消" : "記録"}`,
                  `${revision.actorAccountId} / ${revision.reason} / ${recordedTime.format(revision.recordedAt)}`,
                ],
              }))}
            />
          )}
          <p>旧等級付与の原記録</p>
          {history.archive === null ? (
            <p role="status">原記録の保全状況を確認できません。旧履歴がないことを意味しません。</p>
          ) : (
            <>
              <p>
                保全日：{history.archive.observedOn}
                。保全時の名称は、付与当時の名称を証明するものではありません。
              </p>
              {history.archive.source.awards.length === 0 ? (
                <p>保全時の原記録は0件です。</p>
              ) : (
                <EmployeeGradeHistoryTable
                  label="保全した旧等級付与の原記録"
                  columns={["元の適用日", "元の等級ID・保全時の名称", "元の理由・作成日時"]}
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
