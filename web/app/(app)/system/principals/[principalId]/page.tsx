import Link from "next/link"
import { Suspense } from "react"
import { SystemMachineCredentialSection } from "@/app/(app)/system/principals/[principalId]/_components/system-machine-credential-section"
import { SystemPrincipalDetailSection } from "@/app/(app)/system/principals/[principalId]/_components/system-principal-detail-section"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { ReadOnlyNotice } from "@/components/read-only-notice"
import { requirePermission } from "@/lib/auth/require-permission"

export const metadata = { title: "Principal の詳細" }

type Props = {
  params: Promise<{ principalId: string }>
}

/** 1 件の Principal と、その機械 credential を読む。 */
export default async function SystemPrincipalPage(props: Props) {
  await requirePermission("iam:read")

  const params = await props.params

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Principal の詳細" />

      <ReadOnlyNotice command={null} />

      <Link className="text-sm underline" href="/system/principals">
        Principal の一覧へ戻る
      </Link>

      <Suspense fallback={<ListSkeleton rows={3} />}>
        <SystemPrincipalDetailSection principalId={params.principalId} />
      </Suspense>

      <Suspense fallback={<ListSkeleton rows={3} />}>
        <SystemMachineCredentialSection principalId={params.principalId} />
      </Suspense>
    </div>
  )
}
