import { basename, extname } from "node:path"
import { authenticatedFetch } from "@/lib/api-client.ts"

const CONTENT_TYPES: Readonly<Record<string, string>> = {
  ".pdf": "application/pdf",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".heic": "image/heic",
}

/**
 * MCP host のマシン上にあるファイルを API へ預け、attachment_id を返す。
 * 本体は base64 で会話に載せず、この関数がローカルから直接読んで送る。
 */
export async function uploadAttachment(path: string): Promise<string> {
  const contentType = CONTENT_TYPES[extname(path).toLowerCase()]

  if (contentType === undefined) {
    throw new Error(`添付できるのは ${Object.keys(CONTENT_TYPES).join(", ")} です: ${path}`)
  }

  const file = Bun.file(path)

  if (!(await file.exists())) {
    throw new Error(`ファイルが見つかりません: ${path}`)
  }

  const form = new FormData()

  form.set("file", new File([await file.arrayBuffer()], basename(path), { type: contentType }))

  const response = await authenticatedFetch("/system/attachments", {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(120_000),
  })

  if (!response.ok) {
    throw new Error(`添付のアップロードに失敗しました (${response.status})`)
  }

  const body: unknown = await response.json().catch(() => null)

  if (
    typeof body !== "object" ||
    body === null ||
    !("id" in body) ||
    typeof body.id !== "string" ||
    body.id.trim().length === 0
  ) {
    throw new Error("添付の応答に id がありません")
  }

  return body.id
}
