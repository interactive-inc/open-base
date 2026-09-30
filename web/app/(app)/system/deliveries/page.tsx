import { Suspense } from "react"
import { SystemDeliveryFilterForm } from "@/app/(app)/system/deliveries/_components/system-delivery-filter-form"
import { SystemDeliverySection } from "@/app/(app)/system/deliveries/_components/system-delivery-section"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { ReadOnlyNotice } from "@/components/read-only-notice"
import { requirePermission } from "@/lib/auth/require-permission"
import type {
  SystemDeliveryKind,
  SystemDeliveryStatus,
} from "@/lib/api/types/system-operation-types"

export const metadata = { title: "配信" }

type Props = {
  searchParams: Promise<{ [key: string]: string | Array<string> | undefined }>
}

/**
 * ジョブと送信箱の配信一覧。api が kind を必須にするので既定はジョブにする。
 */
export default async function SystemDeliveriesPage(props: Props) {
  await requirePermission("batch:view")

  const params = await props.searchParams

  const kind = toKind(params.kind)

  const status = toStatus(params.status)

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="配信" />

      <ReadOnlyNotice command={null} />

      <SystemDeliveryFilterForm kind={kind} status={status} />

      <Suspense key={`${kind}:${status ?? ""}`} fallback={<ListSkeleton rows={5} />}>
        <SystemDeliverySection kind={kind} status={status} />
      </Suspense>
    </div>
  )
}

/** kind を api が受け付ける 2 種類に絞る。範囲外はジョブにする。 */
function toKind(value: string | Array<string> | undefined): SystemDeliveryKind {
  if (value === "outbox") return "outbox"

  return "job"
}

/** status を api が受け付ける状態に絞る。範囲外は絞り込み無しにする。 */
function toStatus(value: string | Array<string> | undefined): SystemDeliveryStatus | null {
  if (value === "queued") return "queued"

  if (value === "leased") return "leased"

  if (value === "succeeded") return "succeeded"

  if (value === "dead_letter") return "dead_letter"

  return null
}
