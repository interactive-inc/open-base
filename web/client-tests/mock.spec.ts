import { expect, test } from "@playwright/test"

test.beforeEach(async ({ request }) => {
  expect((await request.post("/__mock/reset")).status()).toBe(204)
})

test("home uses only mocked APIs and remains usable on mobile", async ({ page }) => {
  const failures: string[] = []
  page.on("pageerror", (error) => failures.push(error.message))
  await page.goto("/")
  await expect(page.getByRole("heading", { name: "承認", exact: true })).toBeVisible()
  await expect(page.getByText("休暇の申請")).toBeVisible()
  await expect(page.getByRole("button", { name: "メニューを開閉" })).toBeHidden()
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).not.toBe(
    "rgba(0, 0, 0, 0)",
  )
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByRole("button", { name: "メニューを開閉" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "承認", exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
  expect(failures).toEqual([])
})

test("all client routes load without the backend, passkey mock shows its limit", async ({
  page,
}) => {
  await page.goto("/sign-in")
  await expect(page.getByLabel("メールアドレス")).toBeVisible()
  await page.goto("/enroll")
  await expect(page.getByText("管理者から受け取った招待のURLを開いてください。")).toBeVisible()
  await page.goto("/enroll?token=example-invitation")
  await page.getByRole("button", { name: "パスキーを登録" }).click()
  await expect(page.getByText("実パスキーの操作は通常の開発環境で確認してください。")).toBeVisible()
})

test("device approval completes and a replay is rejected", async ({ page }) => {
  await page.goto("/device?user_code=DEMO-CODE")
  await page.getByRole("button", { name: "承認", exact: true }).click()
  await expect(page.getByRole("heading", { name: "承認しました" })).toBeVisible()
  await page.reload()
  await page.getByRole("button", { name: "承認", exact: true }).click()
  await expect(page.getByText("コードが無効または使用済みです。")).toBeVisible()
})

test("an inbox item is approved on the dedicated decision screen", async ({ page }) => {
  await page.goto("/")
  await page.getByRole("link", { name: /休暇の申請/ }).click()
  // 詳細は見るだけ。判断は、サイドバーの無い専用の画面で行う。
  await expect(page.getByRole("button", { name: "承認する" })).toHaveCount(0)
  await page.getByRole("link", { name: "判断する" }).click()
  await expect(page).toHaveURL(/\/decisions\/applications\//)
  await expect(page.getByRole("navigation", { name: "主な画面" })).toHaveCount(0)
  await page.getByRole("button", { name: "承認する" }).click()
  await expect(page.getByRole("heading", { name: "承認しました" })).toBeVisible()
  await page.goto("/")
  await expect(page.getByRole("link", { name: /休暇の申請/ })).toHaveCount(0)
})

test("mock sign-out and password sign-in return to the home", async ({ page }) => {
  await page.goto("/")
  await page.getByRole("button", { name: /ユーザーメニュー/ }).click()
  await page.getByRole("menuitem", { name: "サインアウト" }).click()
  await expect(page.getByLabel("メールアドレス")).toBeVisible()
  await page.getByLabel("メールアドレス").fill("you@example.com")
  await page.getByLabel("パスワード", { exact: true }).fill("example-mock-password")
  await page.getByRole("button", { name: "サインイン", exact: true }).click()
  await expect(page.getByRole("heading", { name: "承認", exact: true })).toBeVisible()
})

test("every area opens from the mock without errors", async ({ page }) => {
  const failures: string[] = []
  page.on("pageerror", (error) => failures.push(`${page.url()} ${error.message}`))
  page.on("response", (response) => {
    if (response.url().includes("/api/") && response.status() === 501)
      failures.push(`未定義のモック: ${response.url()}`)
  })
  for (const path of [
    "/applications",
    "/applications/templates",
    "/applications/all",
    "/applications/delegations",
    "/applications/repairs",
    "/reviews",
    "/reviews/cycles",
    "/notifications",
    "/employees",
    "/employees/actions",
    "/profile",
    "/organization",
    "/organization/company",
    "/organization/grades",
    "/organization/reporting",
    "/customers",
    "/offerings",
    "/projects",
    "/work",
    "/accounts",
    "/accounts/roles",
    "/accounts/principals",
    "/operations",
    "/operations/audit",
    "/operations/work-items",
    "/operations/deliveries",
    "/operations/connectors",
  ]) {
    await page.goto(path)
    await expect(page.getByRole("heading", { level: 1 }), path).toBeVisible()
    await expect(page.getByRole("navigation", { name: "主な画面" }), path).toBeVisible()
    await page.waitForLoadState("networkidle")
  }
  expect(failures).toEqual([])
})
