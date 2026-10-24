import Link from "next/link"
import { toPrincipalKindLabel } from "@/app/(app)/system/principals/_lib/to-principal-kind-label"
import { FetchError } from "@/components/fetch-error"
import { SystemResourceTable } from "@/components/system-resource-table"
import { getSystemPrincipals } from "@/lib/api/get-system-principals"
import { formatDateTime } from "@/lib/format-date-time"

/**
 * Principal を読み取り専用で並べる。
 * Account ID は既存のアカウント画面へ、connector は Connector 画面へ繋ぐ。
 */
export async function SystemPrincipalSection() {
  const principals = await getSystemPrincipals()

  if (principals instanceof Error) {
    return <FetchError message="主体を読み込めませんでした。" />
  }

  return (
    <SystemResourceTable
      caption="主体の一覧"
      resources={principals}
      toKey={(principal) => principal.id}
      emptyTitle="主体が登録されていません"
      emptyDescription="人以外の主体はAPIまたはCLIから登録します。"
      columns={[
        {
          header: "名称",
          toValue: (principal) => (
            <Link className="underline" href={`/system/principals/${principal.id}`}>
              {principal.name}
            </Link>
          ),
        },
        {
          header: "分類",
          toValue: (principal) => toPrincipalKindLabel(principal.kind),
        },
        {
          header: "アカウント",
          toValue: (principal) => (
            <Link className="font-mono text-xs underline" href="/system/accounts">
              {principal.account_id}
            </Link>
          ),
        },
        {
          header: "コネクタ",
          toValue: (principal) => {
            if (principal.connector_id === null) return "-"

            return (
              <Link
                className="font-mono text-xs underline"
                href={`/system/connectors/${principal.connector_id}`}
              >
                {principal.connector_id}
              </Link>
            )
          },
        },
        {
          header: "作成日時",
          toValue: (principal) => formatDateTime(principal.created_at),
        },
      ]}
    />
  )
}
