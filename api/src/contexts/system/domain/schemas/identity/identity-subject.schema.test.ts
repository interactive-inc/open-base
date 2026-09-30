import { identitySubjectSchema } from "@system/domain/schemas/identity/identity-subject.schema"
import { describe, expect, test } from "bun:test"

describe("identitySubjectSchema", () => {
  test("opaque subjectを正規化せずcase-sensitiveに保持する", () => {
    expect(String(identitySubjectSchema.parse("Subject-A"))).toBe("Subject-A")
  })

  test.each(["subject-a", "Subject-A", "SUBJECT-A", "provider|subject@example.com"])(
    "表示可能ASCIIのopaque subjectを受理する",
    (subject) => {
      expect(String(identitySubjectSchema.parse(subject))).toBe(subject)
    },
  )

  test.each(["", "a".repeat(256), "line\nbreak", "ユーザー"])(
    "空・長過ぎる値・制御文字・非ASCIIを拒否する",
    (subject) => {
      expect(identitySubjectSchema.safeParse(subject).success).toBe(false)
    },
  )
})
