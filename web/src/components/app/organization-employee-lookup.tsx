import { SearchIcon } from "lucide-react"
import { useState, type FormEvent } from "react"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

/**
 * 従業員番号を入れて、その人を表示するための欄。
 * 決めた番号はURLにも残し、読み込み直しても同じ人を表示する。
 */
export function EmployeeLookup(props: {
  value: string | null
  description: string
  onSubmit: (code: string) => void
}) {
  const [code, setCode] = useState(props.value ?? "")
  const [error, setError] = useState<string | null>(null)

  function submit(event: FormEvent) {
    event.preventDefault()
    const value = code.trim()
    if (value === "") {
      setError("従業員番号を入れてください。")
      return
    }
    setError(null)
    const url = new URL(location.href)
    url.searchParams.set("employee", value)
    history.replaceState(null, "", url)
    props.onSubmit(value)
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field name="employee" invalid={error !== null}>
        <FieldLabel>従業員番号</FieldLabel>
        <Input className="max-w-sm" value={code} maxLength={255} onValueChange={setCode} />
        <FieldDescription>{props.description}</FieldDescription>
        {error !== null && <FieldError>{error}</FieldError>}
      </Field>
      <Button type="submit" className="self-start">
        <SearchIcon data-icon="inline-start" />
        表示する
      </Button>
    </form>
  )
}
