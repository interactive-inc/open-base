import Link from "next/link"
import { toPrincipalKindLabel } from "@/app/(app)/system/principals/_lib/to-principal-kind-label"
import { FetchError } from "@/components/fetch-error"
import { getSystemPrincipal } from "@/lib/api/get-system-principal"
import { formatDateTime } from "@/lib/format-date-time"

type Props = {
  principalId: string
}

/** 1 件の Principal の属性を読み取り専用で並べる。 */
export async function SystemPrincipalDetailSection(props: Props) {
  const principal = await getSystemPrincipal(props.principalId)

  if (principal instanceof Error) {
    return <FetchError message="Principal の取得に失敗しました" />
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">{principal.name}</h2>

      <dl className="grid gap-4 rounded-2xl border bg-card p-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <dt className="text-xs text-muted-foreground">識別子</dt>

          <dd className="font-mono text-xs">{principal.id}</dd>
        </div>

        <div className="flex flex-col gap-2">
          <dt className="text-xs text-muted-foreground">分類</dt>

          <dd className="text-sm">{toPrincipalKindLabel(principal.kind)}</dd>
        </div>

        <div className="flex flex-col gap-2">
          <dt className="text-xs text-muted-foreground">アカウント</dt>

          <dd className="font-mono text-xs">
            <Link className="underline" href="/system/accounts">
              {principal.account_id}
            </Link>
          </dd>
        </div>

        <div className="flex flex-col gap-2">
          <dt className="text-xs text-muted-foreground">コネクタ</dt>

          <dd className="font-mono text-xs">
            {principal.connector_id === null ? (
              "-"
            ) : (
              <Link className="underline" href={`/system/connectors/${principal.connector_id}`}>
                {principal.connector_id}
              </Link>
            )}
          </dd>
        </div>

        <div className="flex flex-col gap-2">
          <dt className="text-xs text-muted-foreground">版</dt>

          <dd className="text-sm">{principal.revision}</dd>
        </div>

        <div className="flex flex-col gap-2">
          <dt className="text-xs text-muted-foreground">作成</dt>

          <dd className="text-sm">{formatDateTime(principal.created_at)}</dd>
        </div>

        <div className="flex flex-col gap-2">
          <dt className="text-xs text-muted-foreground">更新</dt>

          <dd className="text-sm">{formatDateTime(principal.updated_at)}</dd>
        </div>
      </dl>
    </section>
  )
}
