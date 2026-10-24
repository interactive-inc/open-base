import { getDictionary } from "@/lib/i18n/get-dictionary"
import { getLocale } from "@/lib/i18n/get-locale"
import type { Translator } from "@/lib/i18n/translator-context"
import { translate } from "@/lib/i18n/translate"

/**
 * server 側（Server Component / Server Action）専用。cookie から言語を読み、
 * 対応する辞書を束ねた翻訳関数 `t` を返す。
 */
export async function getTranslator(): Promise<Translator> {
  const locale = await getLocale()

  const dictionary = getDictionary(locale)

  function t(key: string, vars?: Record<string, string | number>): string {
    return translate(dictionary, key, vars)
  }

  return t
}
