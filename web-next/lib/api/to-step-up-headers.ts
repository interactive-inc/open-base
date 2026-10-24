/**
 * 再認証 grant をリクエストヘッダへ変換する。grant が無いときは空にして、
 * API に 403 `step_up_required` を返させ、画面が再認証を促せるようにする。
 */
export function toStepUpHeaders(stepUpToken: string | null): Record<string, string> {
  if (stepUpToken === null) {
    return {}
  }

  return { "x-system-step-up": stepUpToken }
}
