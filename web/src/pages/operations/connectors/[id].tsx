import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { CurrentProfile } from "@/components/app/app-shell"
import { BackLink, Loaded, PageHeader } from "@/components/app/data-view"
import {
  CONNECTOR_DIRECTION,
  CONNECTOR_STATUS,
  CONNECTOR_TRANSPORT,
  EXCHANGE_STATUS,
  formatDateTime,
} from "@/components/app/operations-format"
import type {
  Connector,
  ConnectorList,
  ExchangeList,
  ExchangeStatus,
  IntegrationExchange,
} from "@/components/app/operations-types"
import { Facts } from "@/components/app/operations-view"
import { useApiJson } from "@/components/app/use-api-json"
import type { Props } from "./[id].server"

type DetailProps = Omit<Props, "initial"> & { initial?: Props["initial"] }

const ORDER: Readonly<Record<ExchangeStatus, number>> = {
  failed: 0,
  pending: 1,
  succeeded: 2,
  cancelled: 3,
}

/** 外部接続の一件。接続の内容と、やり取りの記録を見せる。変更と停止はCLIかMCPで行う。 */
export default function ConnectorPage({ email, pathname, id, initial }: DetailProps) {
  const profile = useApiJson<CurrentProfile>("/company/current-profile", initial?.profile)
  const connectors = useApiJson<ConnectorList>("/system/connectors", initial?.connectors)

  return (
    <>
      <BackLink href="/operations/connectors">外部接続の一覧</BackLink>
      <Loaded state={connectors} fallback={<Skeleton className="h-48 w-full" />}>
        {(data) => {
          const connector = data.connectors.find((item) => item.id === id)
          if (connector === undefined) {
            return (
              <Alert role="status">
                <AlertDescription>
                  この外部接続は見つかりません。一覧から選び直してください。
                </AlertDescription>
              </Alert>
            )
          }
          return (
            <>
              <Summary connector={connector} />
              <Exchanges connectorId={connector.id} initial={initial?.exchanges} />
            </>
          )
        }}
      </Loaded>
    </>
  )
}

function Summary({ connector }: { connector: Connector }) {
  const status = CONNECTOR_STATUS[connector.status]

  return (
    <>
      <PageHeader
        title={connector.name}
        description={<span className="font-mono">{connector.key}</span>}
        badges={<Badge variant={status.variant}>{status.text}</Badge>}
      />
      {connector.status === "disabled" && (
        <Alert variant="destructive" role="status">
          <AlertDescription>
            この接続は止めています。再開されるまで、外部とのやり取りは受け付けません。
          </AlertDescription>
        </Alert>
      )}
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>接続の内容</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Facts
            items={[
              ["向き", CONNECTOR_DIRECTION[connector.direction]],
              ["方式", CONNECTOR_TRANSPORT[connector.transport]],
              ["版", `第 ${connector.revision} 版`],
              ["登録した日時", formatDateTime(connector.created_at)],
              ["更新した日時", formatDateTime(connector.updated_at)],
            ]}
          />
        </CardContent>
      </Card>
    </>
  )
}

function Exchanges(props: {
  connectorId: string
  initial: Props["initial"]["exchanges"] | undefined
}) {
  const exchanges = useApiJson<ExchangeList>(
    `/system/integration-exchanges?connector_id=${props.connectorId}`,
    props.initial,
  )
  const failed =
    exchanges.kind === "ok"
      ? exchanges.data.exchanges.filter((item) => item.status === "failed").length
      : 0

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>やり取りの記録</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p>
          {failed > 0
            ? `失敗したやり取りが ${failed} 件あります。原因を直してから、CLI か MCP でもう一度試してください。`
            : "この接続で行ったやり取りです。中身は保存せず、要約の値だけを持ちます。"}
        </p>
        <Loaded state={exchanges} fallback={<Skeleton className="h-24 w-full" />}>
          {(data) =>
            data.exchanges.length === 0 ? (
              <p>やり取りの記録はまだありません。</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>操作</TableHead>
                    <TableHead>状態</TableHead>
                    <TableHead>向き</TableHead>
                    <TableHead className="text-right">回数</TableHead>
                    <TableHead>更新した日時</TableHead>
                    <TableHead>エラー</TableHead>
                    <TableHead>相手の番号</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.exchanges
                    .toSorted(
                      (left, right) =>
                        ORDER[left.status] - ORDER[right.status] ||
                        right.updated_at.localeCompare(left.updated_at),
                    )
                    .map((exchange) => (
                      <ExchangeRow key={exchange.id} exchange={exchange} />
                    ))}
                </TableBody>
              </Table>
            )
          }
        </Loaded>
      </CardContent>
    </Card>
  )
}

function ExchangeRow({ exchange }: { exchange: IntegrationExchange }) {
  const status = EXCHANGE_STATUS[exchange.status]

  return (
    <TableRow>
      <TableCell className="font-mono">{exchange.operation_key}</TableCell>
      <TableCell>
        <Badge variant={status.variant}>{status.text}</Badge>
      </TableCell>
      <TableCell>{exchange.direction === "inbound" ? "受け取り" : "送り"}</TableCell>
      <TableCell className="text-right tabular-nums">{exchange.attempt} 回目</TableCell>
      <TableCell className="tabular-nums">{formatDateTime(exchange.updated_at)}</TableCell>
      <TableCell className="font-mono">{exchange.last_error_code ?? "なし"}</TableCell>
      <TableCell className="font-mono">{exchange.external_reference ?? "なし"}</TableCell>
    </TableRow>
  )
}
