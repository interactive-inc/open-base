import { FetchError } from "@/components/fetch-error"
import { SystemResourceTable } from "@/components/system-resource-table"
import { getSystemPermissionDefinitions } from "@/lib/api/get-system-permission-definitions"

/**
 * 権限キーのカタログを読み取り専用で並べる。
 * 無効化された App の権限は api 側で除かれるので、ここに出るのは有効な機能のぶんだけ。
 */
export async function SystemPermissionDefinitionSection() {
  const definitions = await getSystemPermissionDefinitions()

  if (definitions instanceof Error) {
    return <FetchError message="権限定義の取得に失敗しました" />
  }

  return (
    <SystemResourceTable
      caption="権限定義の一覧"
      resources={definitions}
      toKey={(definition) => definition.key}
      emptyTitle="権限定義がありません"
      emptyDescription="有効な機能がないため、選べる権限がありません。"
      columns={[
        {
          header: "キー",
          toValue: (definition) => <span className="font-mono text-xs">{definition.key}</span>,
        },
        { header: "分類", toValue: (definition) => definition.category },
        { header: "説明", toValue: (definition) => definition.description },
      ]}
    />
  )
}
