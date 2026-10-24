import { negotiateSystemProblemDetails } from "@system/interface/problem-details/lib/negotiate-system-problem-details"

type Props = Readonly<{
  accept: string | null
  status: number
  code: string
  detail: string
  sourceBody: object
  headers?: Headers
}>

/** 正規化済みerrorを明示opt-in時だけProblem Details responseへ変換する。 */
export function toNegotiatedProblemResponse(props: Props): Response | null {
  const problem = negotiateSystemProblemDetails(props)
  if (problem === null) return null
  const headers = new Headers(props.headers)
  headers.set("content-type", "application/problem+json")
  const vary = headers.get("vary")
  if (vary === null) headers.set("vary", "Accept")
  else if (!vary.split(",").some((field) => field.trim().toLowerCase() === "accept")) {
    headers.set("vary", `${vary}, Accept`)
  }

  return new Response(JSON.stringify(problem), {
    status: problem.status,
    headers,
  })
}
