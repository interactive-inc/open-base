export const DEFAULT_PAGE_SIZE = 20

export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100]

/** searchParams.size を安全にパースする。許可リスト外の値はデフォルトに戻す */
export function parsePageSize(raw: string | undefined): number {
  const size = Number.parseInt(raw ?? "", 10)

  return PAGE_SIZE_OPTIONS.includes(size) ? size : DEFAULT_PAGE_SIZE
}
