import { Cable } from "lucide-react"
import { Link } from "@void/react"
import { Badge } from "@/components/ui/badge"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { CurrentProfile } from "@/components/app/app-shell"
import {
  EmptyState,
  formatDate,
  Loaded,
  PageHeader,
  RowsSkeleton,
} from "@/components/app/data-view"
import {
  CONNECTOR_DIRECTION,
  CONNECTOR_STATUS,
  CONNECTOR_TRANSPORT,
} from "@/components/app/operations-format"
import type { ConnectorList } from "@/components/app/operations-types"
import { useApiJson } from "@/components/app/use-api-json"
import type { Props } from "./index.server"

type ConnectorsProps = Omit<Props, "initial"> & { initial?: Props["initial"] }

/** 外部接続の一覧。止めているものを先に並べる。秘密の値はここで扱わない。 */
export default function Connectors({ email, pathname, initial }: ConnectorsProps) {
  const profile = useApiJson<CurrentProfile>("/company/current-profile", initial?.profile)
  const connectors = useApiJson<ConnectorList>("/system/connectors", initial?.connectors)

  return (
    <>
      <PageHeader
        title="外部接続"
        description="外部の仕組みとのつなぎ先です。鍵や秘密の値は、ここではなく配備の設定で持ちます。"
      />
      <Loaded state={connectors} fallback={<RowsSkeleton />}>
        {(data) =>
          data.connectors.length === 0 ? (
            <EmptyState
              icon={Cable}
              title="外部接続はまだありません"
              description="CLI か MCP で登録すると、ここに出ます。"
            />
          ) : (
            <ul className="flex flex-col gap-4">
              {data.connectors
                .toSorted(
                  (left, right) =>
                    Number(right.status === "disabled") - Number(left.status === "disabled") ||
                    left.name.localeCompare(right.name, "ja"),
                )
                .map((connector) => (
                  <li key={connector.id}>
                    <Card>
                      <CardHeader>
                        <CardTitle>
                          <h2>
                            <Link
                              href={`/operations/connectors/${connector.id}`}
                              className="underline-offset-4 hover:underline"
                            >
                              {connector.name}
                            </Link>
                          </h2>
                        </CardTitle>
                        <CardDescription>
                          <span className="font-mono">{connector.key}</span> ·{" "}
                          {CONNECTOR_DIRECTION[connector.direction]} ·{" "}
                          {CONNECTOR_TRANSPORT[connector.transport]} · 更新{" "}
                          {formatDate(connector.updated_at)}
                        </CardDescription>
                        <div>
                          <Badge variant={CONNECTOR_STATUS[connector.status].variant}>
                            {CONNECTOR_STATUS[connector.status].text}
                          </Badge>
                        </div>
                      </CardHeader>
                    </Card>
                  </li>
                ))}
            </ul>
          )
        }
      </Loaded>
    </>
  )
}
