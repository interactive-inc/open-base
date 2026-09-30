const CATEGORY_LABELS: Record<string, string> = {
  attendance: "勤怠",
  accounting: "経理",
  general_affairs: "総務",
  expense: "経費",
  general: "一般",
  employee: "人事",
}

/** 申請テンプレートのカテゴリ文字列を日本語ラベルに変換する */
export function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category
}
