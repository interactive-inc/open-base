import { InboxIcon, UserXIcon } from "lucide-react"
import { Link } from "@void/react"
import type { CurrentProfile } from "@/components/app/app-shell"
import type { InboxList } from "@/components/app/application-types"
import {
  daysSince,
  EmptyState,
  formatDate,
  Loaded,
  PageHeader,
  RowsSkeleton,
} from "@/components/app/data-view"
import { useApiJson } from "@/components/app/use-api-json"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { Props } from "./index.server"

/** loaderが読んだ `initial` があれば最初から表示する。無いとき（Storybookなど）はブラウザーで読む。 */
type HomeProps = Omit<Props, "initial"> & { initial?: Props["initial"] }

/** この日数を超えて止まっている申請は、目立つように見せる。 */
const STALE_DAYS = 7

/** ホーム。自分が判断する番の申請を、古い順に並べる。 */
export default function Home({ email, pathname, initial }: HomeProps) {
  const profile = useApiJson<CurrentProfile>("/company/current-profile", initial?.profile)
  const inbox = useApiJson<InboxList>(
    "/company/application-requests/inbox?sort=created_at_asc",
    initial?.inbox,
  )

  return (
    <>
      <PageHeader
        title="承認"
        description={
          inbox.kind === "ok" && inbox.data.total > 0
            ? `あなたの判断を待っている申請が ${inbox.data.total} 件あります。古いものから並んでいます。`
            : "あなたの判断を待っている申請がここに並びます。"
        }
      />

      {profile.kind === "forbidden" ? (
        <Alert role="status">
          <UserXIcon aria-hidden="true" />
          <AlertTitle>従業員と結び付いていません</AlertTitle>
          <AlertDescription>
            このアカウントはまだ従業員と結び付いていません。管理者に連携を依頼してください。
          </AlertDescription>
        </Alert>
      ) : (
        <Loaded state={inbox} fallback={<RowsSkeleton />}>
          {(list) =>
            list.data.length === 0 ? (
              <EmptyState
                icon={InboxIcon}
                title="判断を待っている申請はありません"
                description="新しい申請が届くと、ここに出ます。"
              />
            ) : (
              <ul className="flex flex-col gap-4">
                {list.data.map((item) => {
                  const days = daysSince(item.created_at)

                  return (
                    <li key={item.id}>
                      <Card>
                        <CardHeader>
                          <CardTitle>
                            <h2>
                              <Link href={`/applications/${item.id}`} className="hover:underline">
                                {item.template_name}
                              </Link>
                            </h2>
                          </CardTitle>
                          <CardDescription>
                            {item.applicant_name || "申請者不明"} · {formatDate(item.created_at)}
                          </CardDescription>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant={days > STALE_DAYS ? "destructive" : "secondary"}>
                              {days === 0 ? "今日届いた" : `${days}日待っている`}
                            </Badge>
                          </div>
                        </CardHeader>
                      </Card>
                    </li>
                  )
                })}
              </ul>
            )
          }
        </Loaded>
      )}
    </>
  )
}
