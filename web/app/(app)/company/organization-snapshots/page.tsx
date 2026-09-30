import { Suspense } from "react"
import { CompanyOrganizationSnapshotFilterForm } from "@/app/(app)/company/organization-snapshots/_components/company-organization-snapshot-filter-form"
import { CompanyOrganizationSnapshotSection } from "@/app/(app)/company/organization-snapshots/_components/company-organization-snapshot-section"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { ReadOnlyNotice } from "@/components/read-only-notice"
import { requireAnyPermission } from "@/lib/auth/require-any-permission"

export const metadata = { title: "組織の時点断面" }

type Props = {
  searchParams: Promise<{ [key: string]: string | Array<string> | undefined }>
}

/**
 * 指定した時点の組織構造をまとめて読む画面。
 * api の GET は時点指定の読み取りだけを持ち、組織変更の履歴一覧は返さない。
 */
export default async function CompanyOrganizationSnapshotsPage(props: Props) {
  await requireAnyPermission(["employee:read", "org:manage", "system:admin"])

  const params = await props.searchParams

  const effectiveOn = toEffectiveOn(params.effective_on)

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="組織の時点断面" />

      <ReadOnlyNotice command={null} />

      <CompanyOrganizationSnapshotFilterForm effectiveOn={effectiveOn} />

      <Suspense key={effectiveOn ?? ""} fallback={<ListSkeleton rows={5} />}>
        <CompanyOrganizationSnapshotSection effectiveOn={effectiveOn} />
      </Suspense>
    </div>
  )
}

/** effective_on を YYYY-MM-DD の形だけに絞り込む。範囲外は null（現在時点）。 */
function toEffectiveOn(value: string | Array<string> | undefined): string | null {
  if (typeof value !== "string") return null

  if (/^\d{4}-\d{2}-\d{2}$/.test(value) === false) return null

  return value
}
