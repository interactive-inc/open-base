import type { McpServer, ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js"
import type { z } from "zod"
import { apiDownload, apiRequest, type RequestOptions } from "@/lib/api-client"

/** 一つのツール呼び出しが送るAPI要求。`output_path` があれば本体をファイルへ書き出す。 */
export type ApiCall = RequestOptions & { path: string; outputPath?: string }

/** 読み取りだけのツール。 */
export const readOnly: ToolAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
}
/** 記録を足す・改めるツール。利用者の明示の意図が要る。 */
export const write: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
}
/** 取消・削除・停止など、戻せないか影響の大きいツール。 */
export const destructive: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: false,
}

/** URLのpath segmentへ値を入れる。入力のschemaで形を絞ったうえで、ここでも符号化する。 */
export function segment(value: string | number): string {
  return encodeURIComponent(String(value))
}

/** API応答をMCPの結果にする。 */
export function jsonResult(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] }
}

/**
 * 引数のschemaとAPI要求の組み立てだけを宣言してツールを登録する。
 * 認証・認可・入力の最終検証はAPIが行い、ここでは送る前に形を絞る。
 */
export function registerApiTool<Shape extends z.ZodRawShape>(
  server: McpServer,
  spec: {
    name: string
    description: string
    annotations: ToolAnnotations
    input: Shape
    request: (args: z.output<z.ZodObject<Shape>>) => ApiCall
  },
) {
  const handler = async (args: z.output<z.ZodObject<Shape>>) => {
    const { path, outputPath, ...options } = spec.request(args)
    if (outputPath !== undefined) return jsonResult(await apiDownload(path, outputPath, options))
    return jsonResult(await apiRequest(path, options))
  }
  server.registerTool(
    spec.name,
    { description: spec.description, inputSchema: spec.input, annotations: spec.annotations },
    // SDKの引数型は汎用のshapeから導けないため、同じshapeで検証した値を受けるcallbackとして渡す。
    handler as unknown as ToolCallback<Shape>,
  )
}
