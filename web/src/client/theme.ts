/** 画面の配色の選び方。system はOSの配色に従う。 */
export type ThemeChoice = "light" | "dark" | "system"

const STORAGE_KEY = "theme"

/** 保存してある選び方を読む。保存が無いときや読めないときは system。 */
export function readThemeChoice(): ThemeChoice {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return stored === "light" || stored === "dark" ? stored : "system"
  } catch {
    return "system"
  }
}

/**
 * 選び方を画面に反映する。明暗を固定するときは html の data-theme に書き、system では外す。
 * 色の値は `globals.css` が data-theme と OS の配色から決める。
 */
export function applyThemeChoice(choice: ThemeChoice): void {
  const root = document.documentElement
  if (choice === "system") {
    delete root.dataset.theme
    return
  }
  root.dataset.theme = choice
}

/** 選び方を保存して反映する。保存できない環境でも、その場の表示は切り替える。 */
export function saveThemeChoice(choice: ThemeChoice): void {
  try {
    if (choice === "system") window.localStorage.removeItem(STORAGE_KEY)
    else window.localStorage.setItem(STORAGE_KEY, choice)
  } catch {
    // 保存できなくても表示は切り替える。
  }
  applyThemeChoice(choice)
}
