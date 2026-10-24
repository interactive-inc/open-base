import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, test } from "vite-plus/test"
import { DynamicFormFields } from "@/components/dynamic-form-fields"

afterEach(cleanup)

describe("DynamicFormFields", () => {
  test("serializes number inputs as JSON numbers", () => {
    const { container } = render(
      <DynamicFormFields
        name="payload"
        schema={{
          fields: [
            {
              id: "amount",
              label: "Amount",
              type: "number",
              required: true,
              description: null,
              options: null,
            },
          ],
        }}
      />,
    )

    fireEvent.change(screen.getByLabelText(/Amount/), { target: { value: "12000" } })

    const payload = container.querySelector<HTMLInputElement>('input[name="payload"]')
    if (payload === null) throw new Error("payload input not found")

    expect(JSON.parse(payload.value)).toEqual({ amount: 12_000 })
  })
})
