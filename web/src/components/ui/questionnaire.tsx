"use client"

import {
  type CheckboxGroupOptions,
  CheckboxGroup as CheckboxGroupPrimitive,
  CheckboxIndicator as CheckboxIndicatorPrimitive,
  Checkbox as CheckboxPrimitive,
  createCheckboxGroupController,
} from "@ui-sdk/react/checkbox"
import {
  FieldDescription as FieldDescriptionPrimitive,
  FieldError as FieldErrorPrimitive,
  FieldLabel as FieldLabelPrimitive,
  Field as FieldPrimitive,
} from "@ui-sdk/react/field"
import {
  createInputController,
  type InputOptions,
  Input as InputPrimitive,
} from "@ui-sdk/react/input"
import {
  createRadioGroupController,
  type RadioGroupOptions,
  RadioGroup as RadioGroupPrimitive,
  RadioIndicator as RadioIndicatorPrimitive,
  Radio as RadioPrimitive,
} from "@ui-sdk/react/radio"
import { cn } from "cn"
import { CheckIcon } from "lucide-react"
import * as React from "react"
import { Button } from "@/components/ui/button"

type QuestionnaireShortcuts = "letters" | "numbers"

type QuestionnaireValue = string | string[] | null

type Details<T extends { onValueChange?: unknown }> = Parameters<
  Extract<T["onValueChange"], (...args: never[]) => unknown>
>[1]

/** 値が変わった理由（reason）、操作元（source）、取り消し（cancel）を持つ。 */
type QuestionnaireChangeDetails =
  | Details<RadioGroupOptions>
  | Details<CheckboxGroupOptions>
  | Details<InputOptions>

type QuestionnaireEntry = {
  name: string
  element: HTMLElement
  required: boolean
  answered: boolean
  clear: () => void
}

type QuestionnaireContextValue = {
  activeName: string | null
  activeRequired: boolean
  current: number
  total: number
  attempted: readonly string[]
  register: (entry: QuestionnaireEntry) => () => void
  previous: () => void
  next: () => void
  skip: () => void
}

type QuestionnaireItemContextValue = {
  name: string
  multiple: boolean
  required: boolean
  invalid: boolean
  controlled: boolean
  value: QuestionnaireValue
  defaultValue: QuestionnaireValue
  change: (value: QuestionnaireValue, details: QuestionnaireChangeDetails) => void
  clear: React.RefObject<(() => void) | null>
}

const QuestionnaireContext = React.createContext<QuestionnaireContextValue | null>(null)

const QuestionnaireItemContext = React.createContext<QuestionnaireItemContextValue | null>(null)

function useQuestionnaire(part: string) {
  const context = React.useContext(QuestionnaireContext)
  if (!context) {
    throw new Error(`${part} は Questionnaire の中で使う。`)
  }
  return context
}

function useQuestionnaireItem(part: string) {
  const context = React.useContext(QuestionnaireItemContext)
  if (!context) {
    throw new Error(`${part} は QuestionnaireItem の中で使う。`)
  }
  return context
}

const CHOICE_SELECTOR = ':is([role="radio"], [role="checkbox"]):not([data-disabled])'

const ANSWER_SELECTOR = `${CHOICE_SELECTOR}, input:not([aria-hidden="true"])`

const EDITABLE_SELECTOR =
  'input:not([type="checkbox"], [type="radio"]), textarea, select, [contenteditable]'

function hasAnswer(value: QuestionnaireValue) {
  if (Array.isArray(value)) {
    return value.length > 0
  }
  return value !== null && value.trim().length > 0
}

function byDocumentOrder(a: QuestionnaireEntry, b: QuestionnaireEntry) {
  const position = a.element.compareDocumentPosition(b.element)
  if (position & Node.DOCUMENT_POSITION_FOLLOWING) {
    return -1
  }
  return position & Node.DOCUMENT_POSITION_PRECEDING ? 1 : 0
}

function shortcutKeys(shortcuts: QuestionnaireShortcuts) {
  return shortcuts === "letters"
    ? Array.from({ length: 26 }, (_, index) => String.fromCharCode(65 + index))
    : Array.from({ length: 9 }, (_, index) => String(index + 1))
}

function focusAnswer(entry: QuestionnaireEntry) {
  const target =
    entry.element.querySelector<HTMLElement>(`${CHOICE_SELECTOR}[aria-checked="true"]`) ??
    entry.element.querySelector<HTMLElement>(ANSWER_SELECTOR)
  ;(target ?? entry.element).focus()
}

function Questionnaire({
  className,
  item,
  defaultItem,
  onItemChange,
  shortcuts,
  noValidate = true,
  onSubmit,
  onReset,
  onKeyDown,
  onKeyDownCapture,
  ...props
}: React.ComponentProps<"form"> & {
  /** 今の質問の name。渡すと自分で持つことになる。 */
  item?: string
  /** 最初に見せる質問の name。省くと先頭の質問になる。 */
  defaultItem?: string
  onItemChange?: (item: string) => void
  /** 選択肢を数字キーまたは英字キーで選べるようにする。 */
  shortcuts?: QuestionnaireShortcuts
}) {
  const [entries, setEntries] = React.useState<QuestionnaireEntry[]>([])
  const [innerItem, setInnerItem] = React.useState(defaultItem ?? null)
  const [attempted, setAttempted] = React.useState<string[]>([])
  const form = React.useRef<HTMLFormElement | null>(null)
  const pending = React.useRef<{ name: string; answer: boolean } | null>(null)

  const wanted = item ?? innerItem
  const active = entries.find((entry) => entry.name === wanted) ?? entries[0]
  const activeName = active ? active.name : wanted
  const index = active ? entries.indexOf(active) : -1

  const register = React.useCallback((entry: QuestionnaireEntry) => {
    setEntries((previous) =>
      [...previous.filter((other) => other.name !== entry.name), entry].sort(byDocumentOrder),
    )
    return () => {
      setEntries((previous) => previous.filter((other) => other !== entry))
    }
  }, [])

  React.useLayoutEffect(() => {
    const target = pending.current
    if (!target || !active || target.name !== active.name) {
      return
    }
    pending.current = null
    if (target.answer) {
      focusAnswer(active)
      return
    }
    active.element.focus()
  }, [active])

  function go(entry: QuestionnaireEntry, answer = false) {
    if (entry.name === activeName) {
      return
    }
    pending.current = { name: entry.name, answer }
    setInnerItem(entry.name)
    onItemChange?.(entry.name)
  }

  function validate(entry: QuestionnaireEntry) {
    if (entry.answered || !entry.required) {
      return true
    }
    setAttempted((names) => (names.includes(entry.name) ? names : [...names, entry.name]))
    return false
  }

  function previous() {
    const target = entries[index - 1]
    if (target) {
      go(target)
    }
  }

  function next() {
    const target = entries[index + 1]
    if (!active || !target) {
      return
    }
    if (!validate(active)) {
      focusAnswer(active)
      return
    }
    go(target)
  }

  function advance() {
    if (!active) {
      return
    }
    if (!validate(active)) {
      focusAnswer(active)
      return
    }
    const target = entries[index + 1]
    if (target) {
      go(target)
      return
    }
    form.current?.requestSubmit()
  }

  function skip() {
    if (!active || active.required) {
      return
    }
    active.clear()
    const target = entries[index + 1]
    if (target) {
      go(target)
      return
    }
    // 回答を消した結果が反映されてから送信する
    queueMicrotask(() => form.current?.requestSubmit())
  }

  function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    const invalid = entries.find((entry) => !validate(entry))
    if (invalid) {
      event.preventDefault()
      go(invalid, true)
      if (invalid.name === activeName) {
        focusAnswer(invalid)
      }
      return
    }
    onSubmit?.(event)
  }

  function handleReset(event: React.FormEvent<HTMLFormElement>) {
    onReset?.(event)
    if (event.defaultPrevented) {
      return
    }
    setAttempted([])
    const first = entries.find((entry) => entry.name === defaultItem) ?? entries[0]
    if (first) {
      go(first)
    }
  }

  // Enter は入力部品が自分で送信する前に受け取り、次の質問へ進める
  function handleKeyDownCapture(event: React.KeyboardEvent<HTMLFormElement>) {
    onKeyDownCapture?.(event)
    if (
      event.key !== "Enter" ||
      event.nativeEvent.isComposing ||
      event.altKey ||
      event.shiftKey ||
      !active ||
      !(event.target instanceof HTMLElement)
    ) {
      return
    }
    const modified = event.metaKey || event.ctrlKey
    const answer = event.target.closest(ANSWER_SELECTOR)
    if (!modified && !(answer && active.element.contains(answer))) {
      return
    }
    event.preventDefault()
    event.stopPropagation()
    if (!event.repeat) {
      advance()
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLFormElement>) {
    onKeyDown?.(event)
    if (
      event.defaultPrevented ||
      event.nativeEvent.isComposing ||
      event.metaKey ||
      event.ctrlKey ||
      event.altKey ||
      !active ||
      !(event.target instanceof HTMLElement)
    ) {
      return
    }
    const target = event.target
    const role = target.getAttribute("role")
    const editable = target.matches(EDITABLE_SELECTOR)
    const choices = Array.from(active.element.querySelectorAll<HTMLElement>(CHOICE_SELECTOR))

    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      // ラジオは RadioGroup が矢印キーを受け持つ
      const position = choices.indexOf(target)
      if (role !== "checkbox" || position < 0) {
        return
      }
      event.preventDefault()
      const step = event.key === "ArrowDown" ? 1 : -1
      choices[(position + step + choices.length) % choices.length]?.focus()
      return
    }

    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      if (editable || role === "radio") {
        return
      }
      event.preventDefault()
      if (event.repeat) {
        return
      }
      if (event.key === "ArrowLeft") {
        previous()
        return
      }
      next()
      return
    }

    if (!shortcuts || editable) {
      return
    }
    const key = shortcuts === "letters" ? event.key.toUpperCase() : event.key
    const choice = choices[shortcutKeys(shortcuts).indexOf(key)]
    if (!choice) {
      return
    }
    event.preventDefault()
    if (event.repeat) {
      return
    }
    choice.focus()
    if (choice.getAttribute("aria-checked") !== "true" || role !== "radio") {
      choice.click()
    }
  }

  return (
    <QuestionnaireContext
      value={{
        activeName,
        activeRequired: active ? active.required : false,
        current: index + 1,
        total: entries.length,
        attempted,
        register,
        previous,
        next,
        skip,
      }}
    >
      <form
        ref={form}
        data-slot="questionnaire"
        data-shortcuts={shortcuts}
        data-pending={activeName === null ? "" : undefined}
        noValidate={noValidate}
        className={cn("group/questionnaire flex w-full min-w-0 flex-col gap-6", className)}
        onSubmit={handleSubmit}
        onReset={handleReset}
        onKeyDown={handleKeyDown}
        onKeyDownCapture={handleKeyDownCapture}
        {...props}
      />
    </QuestionnaireContext>
  )
}

function QuestionnaireProgress({ className, children, ...props }: React.ComponentProps<"div">) {
  const { current, total } = useQuestionnaire("QuestionnaireProgress")
  const text = total > 0 ? `質問 ${current} / ${total}` : undefined

  return (
    <div
      role="progressbar"
      aria-label="アンケートの進み具合"
      aria-live="polite"
      aria-valuemin={total > 0 ? 1 : undefined}
      aria-valuemax={total > 0 ? total : undefined}
      aria-valuenow={total > 0 ? current : undefined}
      aria-valuetext={text}
      data-slot="questionnaire-progress"
      className={cn(
        "min-h-[1lh] w-fit min-w-[14ch] font-medium text-muted-foreground text-xs tabular-nums",
        className,
      )}
      {...props}
    >
      {children ?? text}
    </div>
  )
}

type QuestionnaireItemProps = Omit<
  React.ComponentProps<typeof FieldPrimitive>,
  "name" | "defaultValue" | "onChange"
> & {
  /** 質問の名前。form を送信すると、この名前で回答が FormData に載る。 */
  name: string
  required?: boolean
} & (
    | {
        /** 複数選択にする。回答は配列になる。 */
        multiple?: false
        value?: string | null
        defaultValue?: string | null
        onValueChange?: (value: string | null, details: QuestionnaireChangeDetails) => void
      }
    | {
        multiple: true
        value?: string[]
        defaultValue?: string[]
        onValueChange?: (value: string[], details: QuestionnaireChangeDetails) => void
      }
  )

function QuestionnaireItem({
  className,
  name,
  multiple = false,
  required = false,
  disabled = false,
  invalid: invalidProp,
  value: valueProp,
  defaultValue,
  onValueChange,
  ...props
}: QuestionnaireItemProps) {
  const root = useQuestionnaire("QuestionnaireItem")
  const [element, setElement] = React.useState<HTMLElement | null>(null)
  const [innerValue, setInnerValue] = React.useState<QuestionnaireValue>(defaultValue ?? null)
  const clear = React.useRef<(() => void) | null>(null)

  const controlled = valueProp !== undefined
  const value = controlled ? valueProp : innerValue
  const answered = hasAnswer(value)
  const active = !disabled && root.activeName === name
  // 質問の並びが分かる前（サーバーでの描画）は、CSS で先頭の質問だけを見せる
  const pending = !disabled && root.activeName === null
  const invalid = invalidProp ?? (required && !answered && root.attempted.includes(name))

  const clearAnswer = React.useCallback(() => {
    clear.current?.()
  }, [])

  const { register } = root
  React.useLayoutEffect(() => {
    if (!element || disabled) {
      return
    }
    return register({ name, element, required, answered, clear: clearAnswer })
  }, [register, element, disabled, name, required, answered, clearAnswer])

  function change(next: QuestionnaireValue, details: QuestionnaireChangeDetails) {
    const notify = onValueChange as
      | ((value: QuestionnaireValue, details: QuestionnaireChangeDetails) => void)
      | undefined
    notify?.(next, details)
    if (details.canceled) {
      return
    }
    setInnerValue(next)
  }

  return (
    <QuestionnaireItemContext
      value={{
        name,
        multiple,
        required,
        invalid,
        controlled,
        value,
        defaultValue: defaultValue ?? null,
        change,
        clear,
      }}
    >
      <FieldPrimitive
        ref={setElement}
        data-questionnaire-item=""
        data-active={active ? "" : undefined}
        data-answered={answered ? "" : undefined}
        hidden={!active && !pending}
        inert={!active && !pending}
        tabIndex={-1}
        disabled={disabled}
        invalid={invalid}
        className={(state) =>
          cn(
            "group/questionnaire-item flex min-w-0 flex-col gap-5 outline-none [[data-pending]_[data-questionnaire-item]~&]:hidden",
            typeof className === "function" ? className(state) : className,
          )
        }
        {...props}
      />
    </QuestionnaireItemContext>
  )
}

function QuestionnaireTitle({
  className,
  ...props
}: React.ComponentProps<typeof FieldLabelPrimitive>) {
  return (
    <FieldLabelPrimitive
      className={(state) =>
        cn(
          "text-pretty font-semibold text-base",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

function QuestionnaireDescription({
  className,
  ...props
}: React.ComponentProps<typeof FieldDescriptionPrimitive>) {
  return (
    <FieldDescriptionPrimitive
      className={(state) =>
        cn(
          // タイトルのすぐ下に付ける
          "-mt-5 text-pretty text-muted-foreground text-sm",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    />
  )
}

type QuestionnaireChoicesProps = Pick<
  React.ComponentProps<"div">,
  "children" | "className" | "id" | "style"
>

const choicesClassName = "grid min-w-0 gap-3 [counter-reset:questionnaire-choice]"

function QuestionnaireRadioChoices({ className, ...props }: QuestionnaireChoicesProps) {
  const item = useQuestionnaireItem("QuestionnaireChoices")
  const [controller] = React.useState(() => createRadioGroupController())
  const value = typeof item.value === "string" ? item.value : null
  const defaultValue = typeof item.defaultValue === "string" ? item.defaultValue : null

  const { clear } = item
  React.useLayoutEffect(() => {
    clear.current = () => controller.setValue(null)
    return () => {
      clear.current = null
    }
  }, [clear, controller])

  return (
    <RadioGroupPrimitive
      name={item.name}
      aria-required={item.required || undefined}
      controller={controller}
      onValueChange={item.change}
      className={cn(choicesClassName, className)}
      {...(item.controlled ? { value } : { defaultValue })}
      {...props}
    />
  )
}

function QuestionnaireCheckboxChoices({ className, ...props }: QuestionnaireChoicesProps) {
  const item = useQuestionnaireItem("QuestionnaireChoices")
  const [controller] = React.useState(() => createCheckboxGroupController())
  const value = Array.isArray(item.value) ? item.value : []
  const defaultValue = Array.isArray(item.defaultValue) ? item.defaultValue : []

  const { clear } = item
  React.useLayoutEffect(() => {
    clear.current = () => controller.setValue([])
    return () => {
      clear.current = null
    }
  }, [clear, controller])

  return (
    <CheckboxGroupPrimitive
      name={item.name}
      aria-required={item.required || undefined}
      controller={controller}
      onValueChange={item.change}
      className={cn(choicesClassName, className)}
      {...(item.controlled ? { value } : { defaultValue })}
      {...props}
    />
  )
}

function QuestionnaireChoices(props: QuestionnaireChoicesProps) {
  const item = useQuestionnaireItem("QuestionnaireChoices")
  return item.multiple ? (
    <QuestionnaireCheckboxChoices {...props} />
  ) : (
    <QuestionnaireRadioChoices {...props} />
  )
}

const choiceControlClassName =
  "relative flex size-4 shrink-0 translate-y-[--spacing(0.45)] cursor-pointer items-center justify-center border border-input outline-none data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground group-has-data-[slot=questionnaire-choice-description]/questionnaire-choice:translate-y-0.5 dark:bg-input/30 dark:data-checked:bg-primary"

function QuestionnaireChoice({
  children,
  className,
  value,
  disabled,
  description,
  ...props
}: Omit<React.ComponentProps<"label">, "htmlFor"> & {
  value: string
  disabled?: boolean
  /** 選択肢の補足。選択肢の名前には含めず、説明として読み上げる。 */
  description?: React.ReactNode
}) {
  const item = useQuestionnaireItem("QuestionnaireChoice")
  const id = React.useId()
  const labelId = `${id}-label`
  const descriptionId = description ? `${id}-description` : undefined

  return (
    <label
      data-slot="questionnaire-choice"
      className={cn(
        "group/questionnaire-choice relative flex min-h-11 cursor-pointer select-none items-start gap-3 rounded-4xl border border-input px-4 py-3.5 text-start text-sm outline-none transition-colors hover:bg-input/40 has-focus-visible:border-ring has-data-checked:border-primary/40 has-data-checked:bg-primary/10 has-focus-visible:ring-[3px] has-focus-visible:ring-ring/50 group-data-invalid/questionnaire-item:border-destructive",
        "not-has-data-disabled:[counter-increment:questionnaire-choice] group-data-[shortcuts=numbers]/questionnaire:[&:nth-child(n+10)>[data-slot=questionnaire-choice-shortcut]]:hidden has-data-disabled:pointer-events-none has-data-disabled:cursor-not-allowed has-data-disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {item.multiple ? (
        <CheckboxPrimitive
          value={value}
          disabled={disabled}
          aria-labelledby={labelId}
          aria-describedby={descriptionId}
          className={cn(choiceControlClassName, "rounded-[6px]")}
        >
          <CheckboxIndicatorPrimitive className="flex items-center justify-center text-current">
            <CheckIcon className="size-3.5" />
          </CheckboxIndicatorPrimitive>
        </CheckboxPrimitive>
      ) : (
        <RadioPrimitive
          value={value}
          disabled={disabled}
          aria-labelledby={labelId}
          aria-describedby={descriptionId}
          className={cn(choiceControlClassName, "rounded-full")}
        >
          <RadioIndicatorPrimitive className="size-2 rounded-full bg-primary-foreground" />
        </RadioPrimitive>
      )}
      <span
        data-slot="questionnaire-choice-label"
        className="flex min-w-0 flex-1 flex-col gap-1 leading-snug"
      >
        <span id={labelId}>{children}</span>
        {description && (
          <span
            id={descriptionId}
            data-slot="questionnaire-choice-description"
            className="text-muted-foreground"
          >
            {description}
          </span>
        )}
      </span>
      <span
        aria-hidden="true"
        data-slot="questionnaire-choice-shortcut"
        className="pointer-events-none ms-auto hidden size-5 shrink-0 translate-y-[--spacing(0.45)] items-center justify-center rounded-full border border-input bg-background/80 font-medium font-mono text-[0.625rem] text-muted-foreground leading-none before:content-[counter(questionnaire-choice)] group-has-data-[slot=questionnaire-choice-description]/questionnaire-choice:translate-y-0.5 group-data-[shortcuts]/questionnaire:inline-flex group-has-data-disabled/questionnaire-choice:hidden group-data-[shortcuts=letters]/questionnaire:before:content-[counter(questionnaire-choice,upper-alpha)]"
      />
    </label>
  )
}

function QuestionnaireInput({
  className,
  ...props
}: Omit<
  React.ComponentProps<typeof InputPrimitive>,
  "name" | "value" | "defaultValue" | "onValueChange" | "controller"
>) {
  const item = useQuestionnaireItem("QuestionnaireInput")
  const [controller] = React.useState(() => createInputController())
  const value = typeof item.value === "string" ? item.value : ""
  const defaultValue = typeof item.defaultValue === "string" ? item.defaultValue : ""

  const { clear } = item
  React.useLayoutEffect(() => {
    clear.current = () => controller.clear()
    return () => {
      clear.current = null
    }
  }, [clear, controller])

  return (
    <InputPrimitive
      // 空欄のままの質問は送信しない
      name={value.trim() ? item.name : undefined}
      aria-required={item.required || undefined}
      controller={controller}
      onValueChange={item.change}
      className={(state) =>
        cn(
          "h-9 min-h-11 w-full min-w-0 rounded-4xl border border-input bg-input/30 px-3 py-1 text-base outline-none transition-[color,box-shadow,background-color] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/20 sm:min-h-0 md:text-sm dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
          "selection:bg-primary selection:text-primary-foreground placeholder:text-muted-foreground",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...(item.controlled ? { value } : { defaultValue })}
      {...props}
    />
  )
}

function QuestionnaireError({
  className,
  children,
  ...props
}: Omit<React.ComponentProps<typeof FieldErrorPrimitive>, "match">) {
  const item = useQuestionnaireItem("QuestionnaireError")

  if (!item.invalid) {
    return null
  }

  return (
    <FieldErrorPrimitive
      match
      role="alert"
      className={(state) =>
        cn(
          "mt-2 text-destructive text-sm",
          typeof className === "function" ? className(state) : className,
        )
      }
      {...props}
    >
      {children ?? "回答してから進んでください。"}
    </FieldErrorPrimitive>
  )
}

function QuestionnaireActions({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="questionnaire-actions"
      className={cn(
        "grid min-h-11 w-full grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 sm:min-h-9",
        className,
      )}
      {...props}
    />
  )
}

type QuestionnaireButtonProps = Omit<React.ComponentProps<typeof Button>, "className" | "type"> & {
  className?: string
}

function QuestionnairePrevious({
  children,
  className,
  variant = "outline",
  onClick,
  ...props
}: QuestionnaireButtonProps) {
  const root = useQuestionnaire("QuestionnairePrevious")

  if (root.current <= 1) {
    return null
  }

  return (
    <Button
      type="button"
      variant={variant}
      className={cn("col-start-1 row-start-1 min-h-11 justify-self-start sm:min-h-0", className)}
      onClick={(event, details) => {
        const result = onClick?.(event, details)
        if (!event.defaultPrevented) {
          root.previous()
        }
        return result
      }}
      {...props}
    >
      {children ?? "戻る"}
    </Button>
  )
}

function QuestionnaireSkip({
  children,
  className,
  variant = "outline",
  onClick,
  ...props
}: QuestionnaireButtonProps) {
  const root = useQuestionnaire("QuestionnaireSkip")

  if (root.total === 0 || root.activeRequired) {
    return null
  }

  return (
    <Button
      type="button"
      variant={variant}
      className={cn("col-start-2 row-start-1 min-h-11 justify-self-end sm:min-h-0", className)}
      onClick={(event, details) => {
        const result = onClick?.(event, details)
        if (!event.defaultPrevented) {
          root.skip()
        }
        return result
      }}
      {...props}
    >
      {children ?? "スキップ"}
    </Button>
  )
}

function QuestionnaireNext({ children, className, onClick, ...props }: QuestionnaireButtonProps) {
  const root = useQuestionnaire("QuestionnaireNext")

  if (root.current >= root.total) {
    return null
  }

  return (
    <Button
      type="button"
      className={cn("col-start-3 row-start-1 min-h-11 justify-self-end sm:min-h-0", className)}
      onClick={(event, details) => {
        const result = onClick?.(event, details)
        if (!event.defaultPrevented) {
          root.next()
        }
        return result
      }}
      {...props}
    >
      {children ?? "次へ"}
    </Button>
  )
}

function QuestionnaireSubmit({ children, className, ...props }: QuestionnaireButtonProps) {
  const root = useQuestionnaire("QuestionnaireSubmit")

  if (root.total === 0 || root.current < root.total) {
    return null
  }

  return (
    <Button
      type="submit"
      className={cn("col-start-3 row-start-1 min-h-11 justify-self-end sm:min-h-0", className)}
      {...props}
    >
      {children ?? "送信"}
    </Button>
  )
}

export {
  Questionnaire,
  QuestionnaireActions,
  type QuestionnaireChangeDetails,
  QuestionnaireChoice,
  QuestionnaireChoices,
  QuestionnaireDescription,
  QuestionnaireError,
  QuestionnaireInput,
  QuestionnaireItem,
  QuestionnaireNext,
  QuestionnairePrevious,
  QuestionnaireProgress,
  QuestionnaireSkip,
  QuestionnaireSubmit,
  QuestionnaireTitle,
}
