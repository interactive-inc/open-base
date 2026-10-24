import { getSystemProblemTitle } from "@system/interface/problem-details/lib/get-system-problem-title"
import type { SystemProblemStatus } from "@system/interface/problem-details/lib/get-system-problem-title"

type Props = Readonly<{
  status: SystemProblemStatus
  code: string
  detail: string
  instance?: string
}>

export type SystemProblemDetails = Readonly<{
  type: string
  title: string
  status: SystemProblemStatus
  detail: string
  code: string
  instance?: string
}>

/** 安定したcodeを同一originのproblem typeへ写像するRFC 9457契約。 */
export function createSystemProblemDetails(props: Props): SystemProblemDetails {
  const problem = {
    type: `/problems/${encodeURIComponent(props.code)}`,
    title: getSystemProblemTitle(props.status),
    status: props.status,
    detail: props.detail,
    code: props.code,
  }

  return props.instance === undefined ? problem : { ...problem, instance: props.instance }
}
