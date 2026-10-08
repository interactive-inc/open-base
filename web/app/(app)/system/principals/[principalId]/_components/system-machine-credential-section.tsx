import { FetchError } from "@/components/fetch-error"
import { SystemResourceTable } from "@/components/system-resource-table"
import { getSystemMachineCredentials } from "@/lib/api/get-system-machine-credentials"
import { formatDateTime } from "@/lib/format-date-time"

type Props = {
  principalId: string
}

const statusLabels: Record<string, string> = {
  active: "有効",
  revoked: "失効",
  expired: "期限切れ",
}

/**
 * Principal に紐づく機械 credential を読み取り専用で並べる。
 * secret 本体は api が返さないので、metadata だけを出す。
 */
export async function SystemMachineCredentialSection(props: Props) {
  const credentials = await getSystemMachineCredentials(props.principalId)

  if (credentials instanceof Error) {
    return <FetchError message="認証情報を読み込めませんでした。" />
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">機械用の認証情報</h2>

      <SystemResourceTable
        caption="機械用の認証情報の一覧"
        resources={credentials}
        toKey={(credential) => credential.id}
        emptyTitle="機械用の認証情報がありません"
        emptyDescription="この主体にはまだ認証情報が発行されていません。発行はAPIまたはCLIから行います。"
        columns={[
          { header: "名称", toValue: (credential) => credential.name },
          {
            header: "状態",
            toValue: (credential) => statusLabels[credential.status] ?? credential.status,
          },
          { header: "作成日時", toValue: (credential) => formatDateTime(credential.created_at) },
          { header: "有効期限", toValue: (credential) => formatDateTime(credential.expires_at) },
          {
            header: "最終利用日時",
            toValue: (credential) => formatDateTime(credential.last_used_at),
          },
          { header: "失効日時", toValue: (credential) => formatDateTime(credential.revoked_at) },
        ]}
      />
    </section>
  )
}
