import Link from "next/link"
import { formatLifecycleKind } from "@/app/(app)/company/_lib/format-lifecycle-kind"
import { summarizeLifecycleEvent } from "@/app/(app)/company/_lib/summarize-lifecycle-event"
import { personnelActionHistoryHref } from "@/app/(app)/company/personnel-actions/_lib/personnel-action-history-href"
import { EmptyState } from "@/components/empty-state"
import { FetchError } from "@/components/fetch-error"
import { TextLink } from "@/components/text-link"
import { StatusLabel } from "@/components/status-label"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  getCompanyPersonnelActions,
  type CompanyPersonnelActionQuery,
} from "@/lib/api/get-company-personnel-actions"

const sourceLabels = { direct: "直接発令", application: "承認申請", system: "システム記録" }

/** 発令の対象、発効日、記録日時と訂正のつながりを表示する。 */
export async function CompanyPersonnelActionSection(
  props: { query?: CompanyPersonnelActionQuery } = {},
) {
  const query = props.query ?? {}
  const actions = await getCompanyPersonnelActions(query)
  if (actions instanceof Error) return <FetchError message="人事発令の取得に失敗しました" />

  return (
    <div className="flex flex-col gap-4">
      {actions.data.length === 0 ? (
        <EmptyState
          title="該当する人事発令はありません"
          description="確定した発令が記録されると、ここに表示されます。"
        />
      ) : (
        <Table>
          <TableCaption>
            人事発令の一覧。記録の新しい順。従業員名とコードは現在の情報です。
          </TableCaption>
          <TableHeader>
            <TableRow>
              {["従業員", "発令・発効日", "記録・来歴", "訂正"].map((heading) => (
                <TableHead key={heading} scope="col">
                  {heading}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {actions.data.map((action) => (
              <TableRow key={action.id}>
                <TableCell>
                  <div className="flex flex-col gap-2">
                    <Link
                      href={personnelActionHistoryHref({ employee_id: action.employee_id })}
                      prefetch={false}
                    >
                      {action.current_employee?.name ?? action.employee_id}
                    </Link>
                    <span>{action.current_employee?.code ?? "コード未設定"}</span>
                    <span className="text-xs text-muted-foreground break-all">
                      {action.employee_id}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-2">
                    <span>{formatLifecycleKind(action.kind)}</span>
                    <time dateTime={action.event_on}>{action.event_on}</time>
                    {summarizeLifecycleEvent(action.summary).map((detail) => (
                      <span key={detail}>{detail}</span>
                    ))}
                    {action.summary.kind === "corrected" ? (
                      <span>
                        訂正後: {formatLifecycleKind(action.summary.replacementKind)} /{" "}
                        {action.summary.replacementEventOn ?? "発効日未記録"}
                      </span>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-2">
                    <time dateTime={action.recorded_at}>{action.recorded_at}</time>
                    <StatusLabel>{sourceLabels[action.source_type]}</StatusLabel>
                    <details>
                      <summary>記録の詳細</summary>
                      <dl className="flex flex-col gap-2">
                        <dt>発令ID</dt>
                        <dd className="break-all">{action.id}</dd>
                        <dt>記録者Account ID</dt>
                        <dd className="break-all">{action.recorded_by_account_id ?? "未記録"}</dd>
                        <dt>申請者Employee ID</dt>
                        <dd className="break-all">{action.requested_by_employee_id ?? "未記録"}</dd>
                        {action.source_application_id !== null ? (
                          <>
                            <dt>申請ID</dt>
                            <dd>{action.source_application_id}</dd>
                          </>
                        ) : null}
                      </dl>
                    </details>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-2">
                    {action.corrects_action_id !== null ? (
                      <Link
                        href={personnelActionHistoryHref({ id: action.corrects_action_id })}
                        prefetch={false}
                      >
                        訂正元の発令
                      </Link>
                    ) : null}
                    {action.corrected_by_action_id !== null ? (
                      <Link
                        href={personnelActionHistoryHref({ id: action.corrected_by_action_id })}
                        prefetch={false}
                      >
                        訂正後の記録
                      </Link>
                    ) : null}
                    {action.corrects_action_id === null && action.corrected_by_action_id === null
                      ? "訂正なし"
                      : null}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <nav aria-label="人事発令履歴のページ" className="flex flex-wrap gap-4">
        {query.cursor !== undefined ? (
          <TextLink
            href={personnelActionHistoryHref({ ...query, cursor: undefined })}
            prefetch={false}
          >
            この条件の最新の履歴
          </TextLink>
        ) : null}
        {actions.next_cursor !== null ? (
          <TextLink
            href={personnelActionHistoryHref({ ...query, cursor: actions.next_cursor })}
            prefetch={false}
          >
            以前の記録を表示
          </TextLink>
        ) : null}
      </nav>
    </div>
  )
}
