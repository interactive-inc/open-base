import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import type { EmployeeProfileVersion } from "@/lib/api/types/employee-profile-version"

type Props = { profile: EmployeeProfileVersion; commandId: string; reasonId: string }

export function EmployeeProfileFields(props: Props) {
  return (
    <>
      <input type="hidden" name="profile_employee_id" value={props.profile.employeeId} />
      <input
        type="hidden"
        name="profile_organization_revision"
        value={props.profile.organizationRevision}
      />
      <input type="hidden" name="profile_person_revision" value={props.profile.personRevision} />
      <input type="hidden" name="profile_effective_on" value={props.profile.effectiveOn} />
      <input type="hidden" name="profile_command_id" value={props.commandId} />
      <Field>
        <FieldLabel htmlFor={props.reasonId}>変更理由</FieldLabel>
        <Input id={props.reasonId} name="reason" maxLength={1500} required />
      </Field>
    </>
  )
}
