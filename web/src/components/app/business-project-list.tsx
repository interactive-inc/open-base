import { Link } from "@void/react"
import { ProjectStage, ProjectStatusLabel } from "@/components/app/business-status"
import { formatMinutes, type ProjectRecord } from "@/components/app/business-types"
import { formatDate } from "@/components/app/data-view"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

/**
 * 案件の一覧。一件ごとのカードに、いまどの段階かを並びで見せる。
 * 顧客名と担当者名は呼ぶ側が引けたときだけ渡す。引けなければ出さない。
 */
export function ProjectList(props: {
  projects: ReadonlyArray<ProjectRecord>
  customerName?: (id: string) => string | null
  ownerName?: (id: string) => string
}) {
  return (
    <ul className="flex flex-col gap-4">
      {props.projects.map((project) => {
        const customer = props.customerName?.(project.customer_id) ?? null
        const facts = [
          customer,
          props.ownerName === undefined
            ? null
            : `担当 ${props.ownerName(project.owner_employee_id)}`,
          project.due_on === null ? null : `期限 ${formatDate(project.due_on)}`,
          project.planned_minutes === null
            ? null
            : `実績 ${formatMinutes(project.actual_minutes ?? 0)} / 予定 ${formatMinutes(project.planned_minutes)}`,
        ].filter((fact): fact is string => fact !== null)

        return (
          <li key={project.id}>
            <Card>
              <CardHeader>
                <CardTitle>
                  <Link
                    href={`/projects/${project.id}`}
                    className="underline-offset-4 hover:underline"
                  >
                    {project.name}
                  </Link>
                </CardTitle>
                {facts.length > 0 && <CardDescription>{facts.join(" · ")}</CardDescription>}
                <CardAction>
                  <ProjectStatusLabel status={project.status} />
                </CardAction>
              </CardHeader>
              <CardContent>
                <ProjectStage status={project.status} label={`${project.name}の段階`} />
              </CardContent>
            </Card>
          </li>
        )
      })}
    </ul>
  )
}
