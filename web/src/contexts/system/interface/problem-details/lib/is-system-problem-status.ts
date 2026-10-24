import type { SystemProblemStatus } from "@system/interface/problem-details/lib/get-system-problem-title"

/** 共通Problem Detailsが定義する4xx/5xx statusだけを受理する。 */
export function isSystemProblemStatus(status: number): status is SystemProblemStatus {
  return (
    status === 400 ||
    status === 401 ||
    status === 403 ||
    status === 404 ||
    status === 409 ||
    status === 413 ||
    status === 415 ||
    status === 422 ||
    status === 423 ||
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503
  )
}
