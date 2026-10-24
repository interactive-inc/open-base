import { describe, expect, test } from "vite-plus/test"
import { canShowApplicationInboxCommand } from "@/lib/application/can-show-application-inbox-command"

describe("canShowApplicationInboxCommand", () => {
  test("shows the command to fixed-permission approvers", () => {
    expect(canShowApplicationInboxCommand(["application:approve"], 0)).toBe(true)
  })

  test("shows the command to workflow candidates with pending inbox work", () => {
    expect(canShowApplicationInboxCommand([], 1)).toBe(true)
  })

  test("hides the command when neither condition applies", () => {
    expect(canShowApplicationInboxCommand([], 0)).toBe(false)
  })
})
