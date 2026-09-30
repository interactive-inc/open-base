import { describe, expect, test } from "vite-plus/test"
import { toFormSchema } from "@/lib/application/form-schema"

describe("toFormSchema", () => {
  test("accepts the current form schema", () => {
    expect(
      toFormSchema({
        fields: [
          {
            id: "amount",
            label: "Amount",
            type: "number",
            required: true,
            description: "Before tax",
            options: null,
          },
        ],
      }),
    ).toEqual({
      fields: [
        {
          id: "amount",
          label: "Amount",
          type: "number",
          required: true,
          description: "Before tax",
          options: null,
        },
      ],
    })
  })

  test("rejects schemas outside the current contract", () => {
    expect(() => toFormSchema({ type: "object", properties: {} })).toThrow()
  })
})
