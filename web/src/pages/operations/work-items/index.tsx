import { ClipboardList } from "lucide-react"
import { Link } from "@void/react"
import { useState } from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { CurrentProfile } from "@/components/app/app-shell"
import {
  EmptyState,
  formatDate,
  Loaded,
  PageHeader,
  RowsSkeleton,
} from "@/components/app/data-view"
import { isOverdue, needsAttention, shortId, WORK_STATE } from "@/components/app/operations-format"
import type { WorkItem, WorkItemPage } from "@/components/app/operations-types"
import { fetchApiJson, useApiJson } from "@/components/app/use-api-json"
import type { Props } from "./index.server"

type WorkItemsProps = Omit<Props, "initial"> & { initial?: Props["initial"] }

/** 並べる順。手当てが要るもの、作業中、終わったものの順。 */
function rank(item: WorkItem): number {
  if (isOverdue(item) || needsAttention(item)) return 0
  if (item.state === "active") return 1
  return 2
}

/** 作業の一覧。受領・確認・引き継ぎを待つものと、期限を過ぎたものを先に並べる。 */
export default function WorkItems({ email, pathname, initial }: WorkItemsProps) {
  const profile = useApiJson<CurrentProfile>("/company/current-profile", initial?.profile)
  const first = useApiJson<WorkItemPage>("/system/work-items?limit=50", initial?.workItems)
  const [more, setMore] = useState<{ items: WorkItem[]; cursor: string | null } | null>(null)
  const [error, setError] = useState(false)

  return (
    <>
      <PageHeader
        title="作業の依頼"
        description="依頼した作業と、その受領・成果の確認・引き継ぎの進み具合です。"
      />
      <Loaded state={first} fallback={<RowsSkeleton rows={4} />}>
        {(page) => {
          const items = [...page.workItems, ...(more?.items ?? [])].toSorted(
            (left, right) =>
              rank(left) - rank(right) || right.recordedAt.localeCompare(left.recordedAt),
          )
          const cursor = more === null ? page.nextCursor : more.cursor
          const waiting = items.filter((item) => rank(item) === 0).length

          async function loadMore() {
            if (cursor === null) return
            setError(false)
            const result = await fetchApiJson<WorkItemPage>(
              `/system/work-items?limit=50&after=${encodeURIComponent(cursor)}`,
            ).catch(() => ({ kind: "error" }) as const)
            if (result.kind !== "ok") {
              setError(true)
              return
            }
            setMore({
              items: [...(more?.items ?? []), ...result.data.workItems],
              cursor: result.data.nextCursor,
            })
          }

          if (items.length === 0) {
            return (
              <EmptyState
                icon={ClipboardList}
                title="まだ作業がありません"
                description="CLI か MCP で依頼すると、ここに出ます。"
              />
            )
          }

          return (
            <div className="flex flex-col gap-4">
              {waiting > 0 && <p>手当てが要る作業が {waiting} 件あります。上に並べています。</p>}
              <ul className="flex flex-col gap-4">
                {items.map((item) => (
                  <li key={item.id}>
                    <Card>
                      <CardHeader>
                        <CardTitle>
                          <h2>
                            <Link
                              href={`/operations/work-items/${item.id}`}
                              className="underline-offset-4 hover:underline"
                            >
                              {item.title}
                            </Link>
                          </h2>
                        </CardTitle>
                        <CardDescription>
                          担当 {shortId(item.assignee.accountId)}
                          {item.dueAt !== null && ` · 期限 ${formatDate(item.dueAt)}`}
                        </CardDescription>
                        <div className="flex flex-wrap gap-2">
                          {isOverdue(item) && <Badge variant="destructive">期限切れ</Badge>}
                          {item.handover !== null && (
                            <Badge variant="secondary">引き継ぎ待ち</Badge>
                          )}
                          <Badge variant={WORK_STATE[item.state].variant}>
                            {WORK_STATE[item.state].text}
                          </Badge>
                        </div>
                      </CardHeader>
                    </Card>
                  </li>
                ))}
              </ul>
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>
                    続きを読み込めませんでした。少し待ってからやり直してください。
                  </AlertDescription>
                </Alert>
              )}
              {cursor !== null && (
                <Button variant="secondary" className="self-start" onClick={loadMore}>
                  さらに読み込む
                </Button>
              )}
            </div>
          )
        }}
      </Loaded>
    </>
  )
}
