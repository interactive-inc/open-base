import { createClient } from "@/lib/api/hc-client"
import { toApiResponseError } from "@/lib/api/to-api-response-error"
import { toStepUpHeaders } from "@/lib/api/to-step-up-headers"
import type { ApiResponseError } from "@/lib/api/api-response-error"

type Props = {
  name: string
  description: string | null
  permissionKeys: ReadonlyArray<string>
  stepUpToken: string | null
}

/**
 * PATCH /system/roles/:roleId。custom System Role を更新する。
 * API が再認証 grant を要求するため、あれば `x-system-step-up` として送る。
 */
export async function updateRole(roleId: string, props: Props): Promise<null | ApiResponseError> {
  const client = await createClient()

  const response = await client.system.roles[":roleId"].$patch(
    {
      param: { roleId },
      json: {
        name: props.name,
        description: props.description,
        permission_keys: [...props.permissionKeys],
      },
    },
    { headers: toStepUpHeaders(props.stepUpToken) },
  )

  if (response.status !== 200) {
    return toApiResponseError(response, "ロールの更新に失敗しました")
  }

  return null
}
