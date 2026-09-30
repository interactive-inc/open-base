import type { EntityId } from "@/lib/api/types/entity-id"
import { formatDateTime } from "@/lib/format-date-time"
import Link from "next/link"
import { ApplicationStatusBadge } from "@/components/application-status-badge"
import { EmptyState } from "@/components/empty-state"
import { SortableTableHead } from "@/components/sortable-table-head"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { ApplicationStatus } from "@/lib/api/types/application-types"

export type AdminApplicationRow = {
  id: EntityId
  template_code: string
  template_name: string
  template_category: string
  applicant_id: string
  applicant_name: string
  applicant_dept_name: string | null
  current_step: string | null
  status: ApplicationStatus
  created_at: string
}

type Props = {
  rows: ReadonlyArray<AdminApplicationRow>
  total: number
  currentSort: "created_at_desc" | "created_at_asc"
  extraParams: Record<string, string | undefined>
}

export function AdminApplicationsTable(props: Props) {
  if (props.rows.length === 0) {
    return <EmptyState title="条件に一致する申請がありません" />
  }

  return (
    <div className="overflow-x-auto">
      <Table aria-label={`全社の申請 ${props.total} 件`}>
        <TableHeader>
          <TableRow>
            <TableHead>申請</TableHead>
            <TableHead>申請者</TableHead>
            <TableHead className="hidden md:table-cell">部署</TableHead>
            <TableHead>ステータス</TableHead>
            <SortableTableHead
              pathname="/system/applications"
              currentSort={props.currentSort}
              ascValue="created_at_asc"
              descValue="created_at_desc"
              label="申請日"
              className="hidden md:table-cell"
              extraParams={props.extraParams}
            />
          </TableRow>
        </TableHeader>

        <TableBody>
          {props.rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell>
                <Link
                  href={`/system/applications/${row.id}`}
                  className="font-medium underline-offset-4 hover:underline"
                >
                  {row.template_name}
                </Link>
              </TableCell>

              <TableCell>
                <Link
                  href={`/system/applications?applicant_id=${row.applicant_id}`}
                  className="underline-offset-4 hover:underline"
                  aria-label={`${row.applicant_name} の申請で絞り込む`}
                >
                  {row.applicant_name}
                </Link>
              </TableCell>

              <TableCell className="hidden md:table-cell">
                {row.applicant_dept_name ?? "—"}
              </TableCell>

              <TableCell>
                <ApplicationStatusBadge status={row.status} />
              </TableCell>

              <TableCell className="hidden md:table-cell">
                {formatDateTime(row.created_at)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
