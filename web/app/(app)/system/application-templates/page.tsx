import { FetchError } from "@/components/fetch-error"
import { Plus } from "lucide-react"
import Link from "next/link"
import { Suspense } from "react"
import { EmptyState } from "@/components/empty-state"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { getApplicationTemplates } from "@/lib/api/get-application-templates"
import { getMe } from "@/lib/api/get-me"
import { canManageApplicationTemplates } from "@/lib/application/can-manage-application-templates"
import { categoryLabel } from "@/lib/category-label"

export const metadata = { title: "申請テンプレート" }

const templateSkeletonPlaceholders = [0, 1, 2, 3, 4, 5]

/**
 * 申請テンプレートの一覧。「テンプレート」というオブジェクトに集中させ、
 * 新規作成は /applications/templates/new に分離する。
 */
export default async function ApplicationTemplatesPage() {
  const currentUser = await getMe()

  const canManage =
    currentUser instanceof Error ? false : canManageApplicationTemplates(currentUser.permissions)

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="申請テンプレート">
        <Button variant="secondary" nativeButton={false} render={<Link href="/my/applications" />}>
          申請一覧へ
        </Button>

        {canManage ? (
          <Button nativeButton={false} render={<Link href="/system/application-templates/new" />}>
            <Plus />
            テンプレートを作成
          </Button>
        ) : null}
      </PageHeader>

      <Suspense fallback={<TemplatesSkeleton />}>
        <TemplatesGrid />
      </Suspense>
    </div>
  )
}

async function TemplatesGrid() {
  const templates = await getApplicationTemplates(null)

  if (templates instanceof Error) {
    return <FetchError message="テンプレートの取得に失敗しました" />
  }

  if (templates.length === 0) {
    return <EmptyState title="利用可能なテンプレートがありません" />
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {templates.map((template) => (
        <Card key={template.code} className="gap-0">
          <Link
            href={`/system/application-templates/${template.code}`}
            className="flex flex-col gap-4 p-4"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{template.name}</span>

              <Badge variant="secondary">{categoryLabel(template.category)}</Badge>
            </div>

            <span className="text-sm text-muted-foreground">
              {template.description ?? "説明なし"}
            </span>
          </Link>
        </Card>
      ))}
    </div>
  )
}

function TemplatesSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {templateSkeletonPlaceholders.map((index) => (
        <Skeleton key={index} className="w-full" />
      ))}
    </div>
  )
}
