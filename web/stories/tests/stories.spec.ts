import { expect, test } from "@playwright/test"

test("全storyの描画・操作テスト・アクセシビリティを確認する", async ({ page, request }) => {
  const response = await request.get("/index.json")
  expect(response.ok()).toBeTruthy()
  const index = (await response.json()) as { entries: Record<string, { id: string; type: string }> }
  const stories = Object.values(index.entries).filter(
    (entry) =>
      entry.type === "story" &&
      (!process.env.STORY_FILTER || entry.id.includes(process.env.STORY_FILTER)),
  )
  expect(stories.length).toBeGreaterThan(process.env.STORY_FILTER ? 0 : 30)
  for (const story of stories) {
    await test.step(story.id, async () => {
      await page.goto(`/iframe.html?id=${encodeURIComponent(story.id)}&viewMode=story`)
      await expect(page.locator("html")).toHaveAttribute("data-story-id", story.id, {
        timeout: 30_000,
      })
      const reports = await page.locator("html").getAttribute("data-story-reports")
      await expect
        .soft(page.locator("html"), reports ?? "Story failed")
        .toHaveAttribute("data-story-status", "success")
      await expect(page.locator("#storybook-root > *").first()).toBeAttached()
    })
  }
})

test("ホームを狭い表示幅と暗い配色で操作する", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto("/iframe.html?id=pages-home--dark&viewMode=story")
  await expect(
    page.locator("html"),
    (await page.locator("html").getAttribute("data-story-reports")) ?? "Story failed",
  ).toHaveAttribute("data-story-status", "success", {
    timeout: 30_000,
  })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy()
  // 狭い幅ではサイドバーを畳み、ヘッダーの左端のボタンから開く。
  await expect(page.getByRole("button", { name: /ユーザーメニュー/ })).toBeVisible()
  await page.getByRole("button", { name: "メニューを開閉" }).click({ timeout: 10_000 })
  await expect(page.getByRole("link", { name: "従業員" })).toBeVisible()
})
