"use client"

import { createContext } from "react"

export type Translator = (key: string, vars?: Record<string, string | number>) => string

export const TranslatorContext = createContext<Translator | null>(null)
