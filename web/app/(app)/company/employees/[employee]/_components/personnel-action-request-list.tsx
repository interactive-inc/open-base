import { formatLifecycleKind } from "@/app/(app)/company/_lib/format-lifecycle-kind"
import { TextLink } from "@/components/text-link"
import { StatusLabel } from "@/components/status-label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { PersonnelActionRequests } from "@/lib/api/list-personnel-action-requests"

export function PersonnelActionRequestList(props: { data: PersonnelActionRequests }) {
  if (props.data.requests.length === 0) return null
  return (
    <Card>
      <CardHeader>
        <CardTitle>進行中の人事変更</CardTitle>
        <CardDescription>承認フローで確定を待っている申請</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-4">
          {props.data.requests.map((request) => (
            <li
              key={request.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-card border p-4"
            >
              <div className="min-w-0">
                <p className="font-medium break-words">{formatLifecycleKind(request.kind)}</p>
                <p className="text-sm text-muted-foreground">
                  申請者: {request.requested_by_employee_name}（{request.requested_by_employee_code}
                  ）
                </p>
              </div>
              <div className="flex items-center gap-2">
                <StatusLabel>承認待ち</StatusLabel>
                <TextLink
                  href={`/system/applications/${request.application_id}`}
                  prefetch={false}
                  className="font-medium"
                >
                  申請を見る
                </TextLink>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
