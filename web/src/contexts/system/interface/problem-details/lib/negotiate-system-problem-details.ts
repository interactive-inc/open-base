import {
  createSystemProblemDetails,
  type SystemProblemDetails,
} from "@system/interface/problem-details/lib/create-system-problem-details"
import { acceptsSystemProblemDetails } from "@system/interface/problem-details/lib/accepts-system-problem-details"
import { getSystemProblemExtensions } from "@system/interface/problem-details/lib/get-system-problem-extensions"
import { isSystemProblemStatus } from "@system/interface/problem-details/lib/is-system-problem-status"

type Props = Readonly<{
  accept: string | null
  status: number
  code: string
  detail: string
  sourceBody: object
  instance?: string
}>

export type NegotiatedSystemProblemDetails = Readonly<
  SystemProblemDetails & Record<string, unknown>
>

/** 明示opt-inされた対応statusだけを安全なProblem Details本文へ変換する。 */
export function negotiateSystemProblemDetails(props: Props): NegotiatedSystemProblemDetails | null {
  if (!acceptsSystemProblemDetails(props.accept) || !isSystemProblemStatus(props.status))
    return null

  const problem = createSystemProblemDetails({
    status: props.status,
    code: props.code,
    detail: props.detail,
    ...(props.instance === undefined ? {} : { instance: props.instance }),
  })
  const extensions = getSystemProblemExtensions(props.sourceBody)

  return { ...problem, ...extensions }
}
