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
    return <FetchError message="機械 credential の取得に失敗しました" />
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">機械 credential</h2>

      <SystemResourceTable
        caption="機械 credential の一覧"
        resources={credentials}
        toKey={(credential) => credential.id}
        emptyTitle="機械 credential がありません"
        emptyDescription="この Principal にはまだ credential が発行されていません。発行は API と CLI から行います。"
        columns={[
          { header: "名称", toValue: (credential) => credential.name },
          {
            header: "状態",
            toValue: (credential) => statusLabels[credential.status] ?? credential.status,
          },
          { header: "作成", toValue: (credential) => formatDateTime(credential.created_at) },
          { header: "有効期限", toValue: (credential) => formatDateTime(credential.expires_at) },
          { header: "最終利用", toValue: (credential) => formatDateTime(credential.last_used_at) },
          { header: "失効", toValue: (credential) => formatDateTime(credential.revoked_at) },
        ]}
      />
    </section>
  )
}
