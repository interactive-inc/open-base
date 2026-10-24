import { describe, expect, spyOn, test } from "bun:test"
import { CreatePasswordResetChallenge } from "@system/application/auth/create-password-reset-challenge"
import type { PasswordResetEmailAdapter } from "@system/infrastructure/adapters/auth/password-reset-email.adapter"
import type { CreateSystemPasswordResetChallengeAdapter } from "@system/infrastructure/adapters/auth/create-system-password-reset-challenge.adapter"

type CreateChallenge =
  CreateSystemPasswordResetChallengeAdapter["createSystemPasswordResetChallenge"]
type SendEmail = PasswordResetEmailAdapter["send"]
type ChallengeProps = Parameters<CreateChallenge>[0]
type EmailProps = Parameters<SendEmail>[0]

const recipient = {
  accountId: "00000000-0000-4000-8000-000000000001",
  identityId: "00000000-0000-4000-8000-000000000002",
  email: "you@example.com",
}

function createHarness(
  options: Readonly<{
    createChallenge?: CreateChallenge
    sendEmail?: SendEmail
  }> = {},
) {
  const deferred: Promise<void>[] = []
  const challenges: ChallengeProps[] = []
  const emails: EmailProps[] = []
  const application = new CreatePasswordResetChallenge({
    now: () => new Date("2026-01-01T00:00:00.000Z"),
    auditContext: {
      requestId: "request-1",
      clientName: "web",
      clientIp: "192.0.2.1",
      externalRequestId: null,
    },
    createChallenge: async (props) => {
      challenges.push(props)
      return options.createChallenge?.(props)
    },
    sendEmail: async (props) => {
      emails.push(props)
      return options.sendEmail ? options.sendEmail(props) : "sent"
    },
    runAfterResponse: (task) => {
      deferred.push(task)
    },
  })
  return { application, deferred, challenges, emails }
}

describe("CreatePasswordResetChallenge", () => {
  test("実在しない宛先は何も保存・送信せず同じ受付結果を返す", async () => {
    const harness = createHarness()

    const result = harness.application.execute({
      origin: "https://app.example.com",
      recipient: null,
    })

    expect(result).toEqual({ ok: true })
    expect(harness.deferred).toHaveLength(0)
    expect(harness.challenges).toHaveLength(0)
    expect(harness.emails).toHaveLength(0)
  })

  test("実在する宛先でもメール送信を待たずに同じ受付結果を同期的に返す", async () => {
    let releaseEmail: (() => void) | undefined
    const emailStarted = Promise.withResolvers<void>()
    const harness = createHarness({
      sendEmail: () => {
        emailStarted.resolve()
        return new Promise<"sent">((resolve) => {
          releaseEmail = () => resolve("sent")
        })
      },
    })

    const result = harness.application.execute({ origin: "https://app.example.com", recipient })

    expect(result).not.toBeInstanceOf(Promise)
    expect(result).toEqual({ ok: true })
    expect(harness.deferred).toHaveLength(1)

    await emailStarted.promise
    expect(harness.challenges).toHaveLength(1)
    expect(harness.emails).toHaveLength(1)
    expect(harness.emails[0]?.to).toBe("you@example.com")
    expect(harness.emails[0]?.token).toMatch(/^[a-f0-9]{64}$/)
    expect(harness.challenges[0]?.accountId).toBe(recipient.accountId)

    releaseEmail?.()
    await harness.deferred[0]
  })

  test("応答後の保存失敗はrejectせずログだけに残しメールを送らない", async () => {
    const consoleError = spyOn(console, "error").mockImplementation(() => {})
    const harness = createHarness({
      createChallenge: async () => new Error("d1_unavailable"),
    })

    const result = harness.application.execute({ origin: "https://app.example.com", recipient })

    expect(result).toEqual({ ok: true })
    expect(await harness.deferred[0]).toBeUndefined()
    expect(harness.emails).toHaveLength(0)
    expect(consoleError).toHaveBeenCalledTimes(1)
    consoleError.mockRestore()
  })

  test("応答後のメール送信失敗や例外はrejectせずログだけに残す", async () => {
    const consoleError = spyOn(console, "error").mockImplementation(() => {})
    const failed = createHarness({ sendEmail: async () => new Error("send_failed") })
    const thrown = createHarness({
      sendEmail: async () => {
        throw new Error("unexpected")
      },
    })

    failed.application.execute({ origin: "https://app.example.com", recipient })
    thrown.application.execute({ origin: "https://app.example.com", recipient })

    expect(await failed.deferred[0]).toBeUndefined()
    expect(await thrown.deferred[0]).toBeUndefined()
    expect(consoleError).toHaveBeenCalledTimes(2)
    consoleError.mockRestore()
  })
})
