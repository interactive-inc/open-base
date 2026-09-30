import { createClient } from "@/lib/api/hc-client"
import { toApiResponseError } from "@/lib/api/to-api-response-error"
import { toStepUpHeaders } from "@/lib/api/to-step-up-headers"
import type { ApiResponseError } from "@/lib/api/api-response-error"

type Props = {
  key: string
  name: string
  description: string | null
  permissionKeys: ReadonlyArray<string>
  stepUpToken: string | null
}

/**
 * POST /system/roles。custom System Role を作成する。
 * API が再認証 grant を要求するため、あれば `x-system-step-up` として送る。
 */
export async function createRole(props: Props): Promise<null | ApiResponseError> {
  const client = await createClient()

  const response = await client.system.roles.$post(
    {
      json: {
        key: props.key,
        name: props.name,
        description: props.description,
        permission_keys: [...props.permissionKeys],
      },
    },
    { headers: toStepUpHeaders(props.stepUpToken) },
  )

  if (response.status !== 201) {
    return toApiResponseError(response, "ロールの作成に失敗しました")
  }

  return null
}
