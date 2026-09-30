import { InputError } from "@/lib/errors"

/**
 * --data <file> で渡された JSON ファイルを読む。
 * 標準入力フォールバックは CLI 側で扱えないため、ここではファイル必須とする。
 */
export async function readJsonFile(path: string): Promise<unknown> {
  const file = Bun.file(path)
  if (!(await file.exists())) {
    throw new InputError(`ファイルが見つかりません: ${path}`)
  }
  try {
    return await file.json()
  } catch (error) {
    throw new InputError(
      `JSON を解析できません: ${path} (${error instanceof Error ? error.message : String(error)})`,
    )
  }
}
