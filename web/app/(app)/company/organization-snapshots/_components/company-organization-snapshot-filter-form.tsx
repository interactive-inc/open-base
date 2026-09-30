import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel, FieldSet } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

type Props = {
  effectiveOn: string | null
}

/** 時点断面の基準日フィルタ。空のときは現在時点を読む。 */
export function CompanyOrganizationSnapshotFilterForm(props: Props) {
  return (
    <form method="get" action="/company/organization-snapshots">
      <FieldSet>
        <FieldGroup className="flex-row flex-wrap items-end gap-4">
          <div className="sm:w-56">
            <Field className="w-full">
              <FieldLabel htmlFor="company-organization-snapshot-date">基準日</FieldLabel>

              <Input
                id="company-organization-snapshot-date"
                name="effective_on"
                type="date"
                defaultValue={props.effectiveOn ?? ""}
              />
            </Field>
          </div>

          <Button type="submit">この日で見る</Button>
        </FieldGroup>
      </FieldSet>
    </form>
  )
}
