-- 人事発令の訂正で置き換えた入退社チェックリストを、削除せず置換済みとして保持する。
-- 置換済みの割当は未完了の重複判定から外し、以後の変更と削除をDBでも拒否する。
DROP INDEX IF EXISTS uq_onboarding_assignments_employee_template;
CREATE UNIQUE INDEX uq_onboarding_assignments_employee_template
ON onboarding_assignments (employee_id, template_code)
WHERE status NOT IN ('completed', 'superseded');

-- 置換済みへ移せるのは、人事発令から生成した進行中の割当だけとする。
CREATE TRIGGER onboarding_assignments_supersede_lifecycle_only
BEFORE UPDATE OF status ON onboarding_assignments
WHEN NEW.status = 'superseded' AND OLD.status <> 'superseded'
  AND (OLD.status <> 'in_progress' OR OLD.lifecycle_action_id IS NULL)
BEGIN SELECT RAISE(ABORT, 'onboarding_assignment_supersede_invalid'); END;

CREATE TRIGGER onboarding_assignments_superseded_insert
BEFORE INSERT ON onboarding_assignments
WHEN NEW.status = 'superseded'
BEGIN SELECT RAISE(ABORT, 'onboarding_assignment_supersede_invalid'); END;

CREATE TRIGGER onboarding_assignments_superseded_immutable
BEFORE UPDATE ON onboarding_assignments
WHEN OLD.status = 'superseded'
BEGIN SELECT RAISE(ABORT, 'onboarding_assignment_superseded'); END;

CREATE TRIGGER onboarding_assignments_superseded_no_delete
BEFORE DELETE ON onboarding_assignments
WHEN OLD.status = 'superseded'
BEGIN SELECT RAISE(ABORT, 'onboarding_assignment_superseded'); END;

-- 置換済みの割当に属するタスクは、置換時点の状態のまま保持する。
CREATE TRIGGER onboarding_tasks_superseded_insert
BEFORE INSERT ON onboarding_tasks
WHEN (SELECT status FROM onboarding_assignments WHERE id = NEW.assignment_id) = 'superseded'
BEGIN SELECT RAISE(ABORT, 'onboarding_assignment_superseded'); END;

CREATE TRIGGER onboarding_tasks_superseded_update
BEFORE UPDATE ON onboarding_tasks
WHEN (SELECT status FROM onboarding_assignments WHERE id = OLD.assignment_id) = 'superseded'
  OR (SELECT status FROM onboarding_assignments WHERE id = NEW.assignment_id) = 'superseded'
BEGIN SELECT RAISE(ABORT, 'onboarding_assignment_superseded'); END;

CREATE TRIGGER onboarding_tasks_superseded_no_delete
BEFORE DELETE ON onboarding_tasks
WHEN (SELECT status FROM onboarding_assignments WHERE id = OLD.assignment_id) = 'superseded'
BEGIN SELECT RAISE(ABORT, 'onboarding_assignment_superseded'); END;
