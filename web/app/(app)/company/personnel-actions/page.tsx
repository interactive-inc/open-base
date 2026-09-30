import { Suspense } from "react"
import { z } from "zod"
import { CompanyPersonnelActionSection } from "@/app/(app)/company/personnel-actions/_components/company-personnel-action-section"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { TextLink } from "@/components/text-link"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { requireAnyPermission } from "@/lib/auth/require-any-permission"

export const metadata = { title: "人事発令" }

/** 全社の確定した人事発令を記録順で読む。 */
export default async function CompanyPersonnelActionsPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireAnyPermission(["employee:read", "system:admin"])
  const parsed = z
    .object({
      id: z.string().max(255).optional(),
      employee_id: z.string().max(255).optional(),
      from: z.union([z.literal(""), z.string().date()]).optional(),
      to: z.union([z.literal(""), z.string().date()]).optional(),
      cursor: z.string().max(2048).optional(),
      limit: z.coerce.number().int().min(1).max(100).optional(),
    })
    .strict()
    .refine((query) => !query.from || !query.to || query.from <= query.to)
    .safeParse(await props.searchParams)
  if (!parsed.success)
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title="人事発令" />
        <Alert>
          <AlertDescription>
            検索条件が不正です。期間や履歴リンクを確認してください。
          </AlertDescription>
        </Alert>
        <TextLink href="/company/personnel-actions" prefetch={false}>
          検索条件を解除
        </TextLink>
      </div>
    )
  const query = {
    ...parsed.data,
    id: parsed.data.id || undefined,
    employee_id: parsed.data.employee_id || undefined,
    from: parsed.data.from || undefined,
    to: parsed.data.to || undefined,
  }
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="人事発令" />
      <p className="text-sm text-muted-foreground">
        入社・異動・退職など、確定した発令の履歴です。発効日と記録日時を区別し、訂正前の記録も残します。
      </p>
      <form action="/company/personnel-actions" method="get" className="flex flex-col gap-4">
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="history-employee">従業員ID</FieldLabel>
            <Input id="history-employee" name="employee_id" defaultValue={query.employee_id} />
          </Field>
          <Field>
            <FieldLabel htmlFor="history-from">発効日（開始）</FieldLabel>
            <Input id="history-from" name="from" type="date" defaultValue={query.from} />
          </Field>
          <Field>
            <FieldLabel htmlFor="history-to">発効日（終了）</FieldLabel>
            <Input id="history-to" name="to" type="date" defaultValue={query.to} />
          </Field>
        </FieldGroup>
        <div className="flex items-center gap-4">
          <Button type="submit">絞り込む</Button>
          <TextLink href="/company/personnel-actions" prefetch={false}>
            検索条件を解除
          </TextLink>
        </div>
      </form>
      {query.id !== undefined ? <p>発令ID: {query.id}</p> : null}
      <Suspense key={JSON.stringify(query)} fallback={<ListSkeleton rows={5} />}>
        <CompanyPersonnelActionSection query={query} />
      </Suspense>
    </div>
  )
}
