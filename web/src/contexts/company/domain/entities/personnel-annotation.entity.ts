import { z } from "zod"

const personnelAnnotationPropsSchema = z.object({
  id: z.uuid(),
  employeeId: z.string(),
  kind: z.string(),
  effectiveDate: z.string(),
  fromDepartmentCode: z.string().nullable(),
  toDepartmentCode: z.string().nullable(),
  note: z.string().nullable(),
  createdAt: z.string(),
})

export type PersonnelAnnotationProps = z.infer<typeof personnelAnnotationPropsSchema>

/** 旧人事注記の原記録。文字列を補正せず、確定した発令へ読み替えない。 */
export class PersonnelAnnotationEntity {
  private static parse(props: unknown): PersonnelAnnotationProps {
    const parsed = personnelAnnotationPropsSchema.parse(props)
    return parsed
  }

  private constructor(private readonly props: PersonnelAnnotationProps) {
    Object.freeze(this)
  }

  static restore(props: unknown): PersonnelAnnotationEntity {
    return new PersonnelAnnotationEntity(PersonnelAnnotationEntity.parse(props))
  }

  toProps(): PersonnelAnnotationProps {
    return this.props
  }
}
