import { EmptyState } from "@/components/empty-state"
import { FetchError } from "@/components/fetch-error"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel, FieldSet } from "@/components/ui/field"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { getSystemConnectors } from "@/lib/api/get-system-connectors"

type Props = {
  connectorId: string | null
}

/**
 * 外部交換を読むコネクタを選ぶ。
 * api が connector_id を必須にするので、全件を横断して読む手段はない。
 */
export async function SystemExchangeConnectorForm(props: Props) {
  const connectors = await getSystemConnectors()

  if (connectors instanceof Error) {
    return <FetchError message="コネクタの取得に失敗しました" />
  }

  if (connectors.length === 0) {
    return (
      <EmptyState
        title="コネクタが登録されていません"
        description="外部交換はコネクタ単位で記録します。先にコネクタを登録します。"
      />
    )
  }

  return (
    <form method="get" action="/system/integration-exchanges">
      <FieldSet>
        <FieldGroup className="flex-row flex-wrap items-end gap-4">
          <div className="sm:w-72">
            <Field className="w-full">
              <FieldLabel htmlFor="system-exchange-connector">コネクタ</FieldLabel>

              <NativeSelect
                id="system-exchange-connector"
                name="connector_id"
                defaultValue={props.connectorId ?? connectors[0].id}
                className="w-full"
              >
                {connectors.map((connector) => (
                  <NativeSelectOption key={connector.id} value={connector.id}>
                    {connector.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
          </div>

          <Button type="submit">表示</Button>
        </FieldGroup>
      </FieldSet>
    </form>
  )
}
