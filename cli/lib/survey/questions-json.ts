import { z } from "zod"
import { UsageError } from "@/lib/errors"
import { readJsonFile } from "@/lib/io/read-json"

const surveyQuestionSchema = z.object({
  id: z.string(),
  type: z.enum(["scale", "choice", "text"]),
  text: z.string(),
})

export type SurveyQuestionInput = z.infer<typeof surveyQuestionSchema>

/** --questions <file> を API と同じ設問配列として読む。未指定なら空配列。 */
export async function toQuestionsJson(
  filePath: string | undefined,
): Promise<ReadonlyArray<SurveyQuestionInput>> {
  if (filePath === undefined) {
    return []
  }

  const parsed = z
    .array(surveyQuestionSchema)
    .max(100)
    .safeParse(await readJsonFile(filePath))

  if (parsed.success === false) {
    throw new UsageError("--questions の JSON は id/type/text を持つ設問配列である必要があります")
  }

  return parsed.data
}
