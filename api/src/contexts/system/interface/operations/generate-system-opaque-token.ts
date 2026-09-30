import { generateOpaqueToken } from "@system/lib/auth/generate-opaque-token"

/** Systemが所有する検証・生成処理を公開操作として実行する。 */
export function generateSystemOpaqueToken(...input: Parameters<typeof generateOpaqueToken>) {
  return generateOpaqueToken(...input)
}
