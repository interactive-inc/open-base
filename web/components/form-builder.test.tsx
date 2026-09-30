import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, test } from "vite-plus/test"
import { FormBuilder } from "@/components/form-builder"
import type { FormField } from "@/lib/application/form-schema"

afterEach(cleanup)

const firstField: FormField = {
  id: "field_1",
  label: "申請理由",
  type: "text",
  required: true,
  description: null,
  options: null,
}

const secondField: FormField = {
  id: "field_2",
  label: "希望日",
  type: "date",
  required: false,
  description: null,
  options: null,
}

function toHiddenValue(container: HTMLElement) {
  const input = container.querySelector('input[name="form_schema"]')

  if (!(input instanceof HTMLInputElement)) {
    throw new Error("hidden input が見つからない")
  }

  return input.value
}

describe("FormBuilder", () => {
  test("keeps the initial order in the hidden input", () => {
    const rendered = render(
      <FormBuilder name="form_schema" initialSchema={{ fields: [firstField, secondField] }} />,
    )

    expect(toHiddenValue(rendered.container)).toBe(
      JSON.stringify({ fields: [firstField, secondField] }),
    )
  })

  test("reorders fields with the keyboard", () => {
    const rendered = render(
      <FormBuilder name="form_schema" initialSchema={{ fields: [firstField, secondField] }} />,
    )

    fireEvent.keyDown(screen.getByRole("button", { name: "項目 1 を並べ替え（上下キーで移動）" }), {
      key: "ArrowDown",
    })

    expect(toHiddenValue(rendered.container)).toBe(
      JSON.stringify({ fields: [secondField, firstField] }),
    )
  })

  test("does not move the first field above the list", () => {
    const rendered = render(
      <FormBuilder name="form_schema" initialSchema={{ fields: [firstField, secondField] }} />,
    )

    fireEvent.keyDown(screen.getByRole("button", { name: "項目 1 を並べ替え（上下キーで移動）" }), {
      key: "ArrowUp",
    })

    expect(toHiddenValue(rendered.container)).toBe(
      JSON.stringify({ fields: [firstField, secondField] }),
    )
  })

  test("renders a drag handle for every field", () => {
    render(<FormBuilder name="form_schema" initialSchema={{ fields: [firstField, secondField] }} />)

    expect(screen.getByRole("button", { name: "項目 1 を並べ替え（上下キーで移動）" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "項目 2 を並べ替え（上下キーで移動）" })).toBeTruthy()
  })

  test("restores entered options after switching the field type away and back", () => {
    const selectField: FormField = {
      id: "field_3",
      label: "希望する備品",
      type: "select",
      required: false,
      description: null,
      options: ["椅子", "机"],
    }

    const rendered = render(
      <FormBuilder name="form_schema" initialSchema={{ fields: [selectField] }} />,
    )

    const typeSelect = screen.getByLabelText("項目の種類")

    fireEvent.change(typeSelect, { target: { value: "text" } })

    fireEvent.change(typeSelect, { target: { value: "select" } })

    expect(toHiddenValue(rendered.container)).toBe(JSON.stringify({ fields: [selectField] }))
  })

  test("persists options as null for non-select fields", () => {
    const selectField: FormField = {
      id: "field_3",
      label: "希望する備品",
      type: "select",
      required: false,
      description: null,
      options: ["椅子", "机"],
    }

    const rendered = render(
      <FormBuilder name="form_schema" initialSchema={{ fields: [selectField] }} />,
    )

    fireEvent.change(screen.getByLabelText("項目の種類"), { target: { value: "text" } })

    expect(toHiddenValue(rendered.container)).toBe(
      JSON.stringify({ fields: [{ ...selectField, type: "text", options: null }] }),
    )
  })
})
