import { resolveStepUpReturnPath } from "@/lib/auth/resolve-step-up-return-path"

type Props = Readonly<{ isConfigured: boolean; purpose: string | null; returnTo: string | null }>

/** 再認証のやり直しも新しいPKCEから開始し、目的と安全な戻り先だけを引き継ぐ。 */
export function resolveIdentityRetryPath(props: Props): string {
  if (!props.isConfigured) return "/"
  if (props.purpose !== "step-up") return "/auth/broker/login"

  const query = new URLSearchParams({
    purpose: "step-up",
    return_to: resolveStepUpReturnPath(props.returnTo) ?? "/",
  })

  return `/auth/broker/login?${query}`
}
