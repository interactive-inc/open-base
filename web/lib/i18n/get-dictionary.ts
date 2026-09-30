import { en } from "@/lib/i18n/dictionaries/en"
import type { Locale } from "@/lib/i18n/locale"

/**
 * ロケールに対応する辞書を返す。`ja` は辞書を引かずキーをそのまま表示する運用のため空辞書、
 * `en` のみ実体を持つ。
 */
export function getDictionary(locale: Locale): Record<string, string> {
  if (locale === "en") {
    return en
  }

  return {}
}
