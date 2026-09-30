import { z } from "zod"

/**
 * アプリが対応する表示言語。日本語 / 英語の2つのみ。
 */
export const zLocale = z.enum(["ja", "en"])

export type Locale = z.infer<typeof zLocale>

export const defaultLocale: Locale = "ja"

export const localeCookieName = "locale"
