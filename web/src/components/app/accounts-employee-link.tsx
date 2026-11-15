import { useEffect, useState } from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { companyToday, fetchAccountEmployeeLinks } from "@/components/app/accounts-api"
import type {
  AccountDirectoryEntry,
  AccountEmployeeLink,
  AccountEmployeeLinkList,
} from "@/components/app/accounts-types"
import { Loaded } from "@/components/app/data-view"
import type { ApiJsonState } from "@/components/app/use-api-json"

/** 今日の時点で効いている、このAccountの結び付け。 */
function currentLink(
  list: AccountEmployeeLinkList,
  accountId: string,
  today: string,
): AccountEmployeeLink | undefined {
  return list.resources.find(
    (link) =>
      link.state === "active" &&
      link.attributes.accountId === accountId &&
      link.effectiveFrom <= today &&
      (link.effectiveTo === null || today < link.effectiveTo),
  )
}

/**
 * Accountと従業員の結び付け。会社の判断資格は従業員の側にあるので、結び付いて初めて業務の権限が効く。
 * 結び付けと解除はCLIかMCPで行う。
 */
export function AccountEmployeeLinkPanel(props: {
  accountId: string
  organizationId: string | null
  person: AccountDirectoryEntry | undefined
}) {
  const [links, setLinks] = useState<ApiJsonState<AccountEmployeeLinkList>>({ kind: "loading" })
  const organizationId = props.organizationId

  useEffect(() => {
    if (organizationId === null) return
    const controller = new AbortController()
    fetchAccountEmployeeLinks(organizationId, controller.signal).then((state) => {
      if (!controller.signal.aborted) setLinks(state)
    })
    return () => controller.abort()
  }, [organizationId])

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>従業員との結び付け</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {organizationId === null ? (
          <Alert role="status">
            <AlertDescription>
              会社の情報が読めないため、結び付けを表示できません。読み込み直してください。
            </AlertDescription>
          </Alert>
        ) : (
          <Loaded state={links} fallback={<Skeleton className="h-5 w-2/3" />}>
            {(list) => {
              const link = currentLink(list, props.accountId, companyToday())
              return link === undefined ? (
                <p>まだ従業員と結び付いていません。CLI か MCP で結び付けると、ここに出ます。</p>
              ) : (
                <p>
                  <span className="font-medium">
                    {props.person?.name ?? `従業員 ${link.attributes.employeeId}`}
                  </span>
                  {props.person?.email !== undefined && props.person.email !== null && (
                    <span className="text-muted-foreground"> · {props.person.email}</span>
                  )}
                  <span> と結び付いています。</span>
                </p>
              )
            }}
          </Loaded>
        )}
      </CardContent>
    </Card>
  )
}
