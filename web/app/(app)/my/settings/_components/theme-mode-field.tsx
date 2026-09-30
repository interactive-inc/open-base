"use client"

import { Monitor, Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldTitle,
} from "@/components/ui/field"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

type ThemeMode = "system" | "light" | "dark"

const themeModes: ReadonlyArray<{
  value: ThemeMode
  label: string
  icon: typeof Monitor
}> = [
  { value: "system", label: "システム設定", icon: Monitor },
  { value: "light", label: "ライト", icon: Sun },
  { value: "dark", label: "ダーク", icon: Moon },
]

function toThemeMode(value: string | undefined): ThemeMode {
  if (value === "light" || value === "dark" || value === "system") {
    return value
  }

  return "system"
}

export function ThemeModeField() {
  const [mounted, setMounted] = useState(false)
  const { resolvedTheme, setTheme, theme } = useTheme()

  useEffect(() => {
    setMounted(true)
  }, [])

  const selectedTheme = mounted ? toThemeMode(theme) : "system"
  const resolvedThemeLabel = resolvedTheme === "dark" ? "ダーク" : "ライト"

  function handleValueChange(value: string[]) {
    const nextTheme = value.at(0)

    if (nextTheme === undefined) return

    setTheme(toThemeMode(nextTheme))
  }

  return (
    <FieldGroup>
      <Field orientation="vertical">
        <FieldContent>
          <FieldTitle id="theme-mode-label">表示テーマ</FieldTitle>
          <FieldDescription>
            システム設定を選ぶと、OSのライト/ダーク設定に合わせて表示します。
            {mounted ? ` 現在の表示は${resolvedThemeLabel}です。` : ""}
          </FieldDescription>
        </FieldContent>

        <ToggleGroup
          aria-labelledby="theme-mode-label"
          value={[selectedTheme]}
          onValueChange={handleValueChange}
          variant="outline"
          spacing={0}
          disabled={!mounted}
          className="w-full flex-wrap"
        >
          {themeModes.map((mode) => {
            const Icon = mode.icon

            return (
              <ToggleGroupItem key={mode.value} value={mode.value} className="flex-1 sm:flex-none">
                <Icon data-icon="inline-start" />
                {mode.label}
              </ToggleGroupItem>
            )
          })}
        </ToggleGroup>
      </Field>
    </FieldGroup>
  )
}
