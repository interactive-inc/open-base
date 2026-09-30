import { basename, extname } from "node:path"
import { resolveBaseUrl } from "@/lib/config/resolve-base-url"
import { SettingsFile } from "@/lib/config/settings-file"
import { UsageError } from "@/lib/errors"

const CONTENT_TYPES: Readonly<Record<string, string>> = {
  ".pdf": "application/pdf",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".heic": "image/heic",
}

/** 拡張子から content-type を決める。サーバー側の allowlist と同じ範囲。 */
function toContentType(path: string): string {
  const contentType = CONTENT_TYPES[extname(path).toLowerCase()]

  if (contentType === undefined) {
    throw new UsageError(
      `添付できるのは ${Object.keys(CONTENT_TYPES).join(", ")} です: ${basename(path)}`,
    )
  }

  return contentType
}

/**
 * ローカルファイルを API へ預け、attachment_id を返す。
 * 本体は API 経由でのみ保管されるため、CLI は署名付き URL を扱わない。
 */
export async function uploadAttachment(
  path: string,
  baseUrlOverride?: string | null,
): Promise<string> {
  const baseUrl = resolveBaseUrl(baseUrlOverride)

  const tokens = await new SettingsFile().tokensFor(baseUrl)

  const file = Bun.file(path)

  if (!(await file.exists())) {
    throw new UsageError(`ファイルが見つかりません: ${path}`)
  }

  const form = new FormData()

  form.set(
    "file",
    new File([await file.arrayBuffer()], basename(path), {
      type: toContentType(path),
    }),
  )

  const headers: Record<string, string> = {}

  if (tokens.token !== null) {
    headers.Authorization = `Bearer ${tokens.token}`
  }

  const response = await fetch(new URL("/system/attachments", baseUrl), {
    method: "POST",
    headers,
    body: form,
  })

  if (!response.ok) {
    throw new UsageError(`添付のアップロードに失敗しました (${response.status})`)
  }

  const body = await response.json()

  if (typeof body !== "object" || body === null) {
    throw new UsageError("添付の応答を解釈できません")
  }

  const record: Record<string, unknown> = { ...body }

  if (typeof record.id !== "string") {
    throw new UsageError("添付の応答に id がありません")
  }

  return record.id
}
