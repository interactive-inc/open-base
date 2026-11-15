import { PackageIcon } from "lucide-react"
import type { CurrentProfile } from "@/components/app/app-shell"
import { FeatureGate, useFeatures } from "@/components/app/business-feature"
import { CatalogStatusLabel } from "@/components/app/business-status"
import {
  formatDateTime,
  OFFERING_TYPE_TEXT,
  type OfferingRecord,
  type RecordPage,
} from "@/components/app/business-types"
import { EmptyState, Loaded, PageHeader, RowsSkeleton } from "@/components/app/data-view"
import { useApiJson } from "@/components/app/use-api-json"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { Props } from "./index.server"

type OfferingsProps = Omit<Props, "initial"> & { initial?: Props["initial"] }

/** 提供している商品・サービスの一覧。 */
export default function Offerings({ email, pathname, initial }: OfferingsProps) {
  const profile = useApiJson<CurrentProfile>("/company/current-profile", initial?.profile)
  const features = useFeatures(initial?.features)

  return (
    <>
      <PageHeader
        title="サービス"
        description="案件で提供する商品とサービスです。利用を止めたものは下に並びます。"
      />
      <FeatureGate features={features} feature="offering" name="サービス">
        <OfferingList initial={initial?.offerings ?? undefined} />
      </FeatureGate>
    </>
  )
}

function OfferingList(props: { initial: NonNullable<Props["initial"]>["offerings"] | undefined }) {
  const offerings = useApiJson<RecordPage<OfferingRecord>>(
    "/offering/records?limit=100",
    props.initial ?? undefined,
  )

  return (
    <Loaded state={offerings} fallback={<RowsSkeleton />}>
      {(page) =>
        page.data.length === 0 ? (
          <EmptyState
            icon={PackageIcon}
            title="まだサービスがありません"
            description="CLI か MCP でサービスを登録すると、ここに出ます。"
          />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>
                <h2>商品とサービス</h2>
              </CardTitle>
              <CardDescription>{page.data.length}件</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>コード</TableHead>
                    <TableHead>名前</TableHead>
                    <TableHead>種類</TableHead>
                    <TableHead>最後の変更</TableHead>
                    <TableHead>状態</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...page.data]
                    .sort(
                      (a, b) =>
                        Number(b.status === "active") - Number(a.status === "active") ||
                        a.code.localeCompare(b.code, "ja"),
                    )
                    .map((offering) => (
                      <TableRow key={offering.id}>
                        <TableCell className="tabular-nums">{offering.code}</TableCell>
                        <TableCell className="font-medium">{offering.name}</TableCell>
                        <TableCell>{OFFERING_TYPE_TEXT[offering.type]}</TableCell>
                        <TableCell className="text-muted-foreground">
                          第{offering.revision}版 {formatDateTime(offering.recorded_at)}
                        </TableCell>
                        <TableCell>
                          <CatalogStatusLabel status={offering.status} />
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )
      }
    </Loaded>
  )
}
