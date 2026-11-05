-- 実行履歴を持たない業務定義だけを、全revisionごと削除できるようにする。
DROP TRIGGER work_execution_definition_no_delete;
--> statement-breakpoint
CREATE TRIGGER work_execution_definition_no_delete BEFORE DELETE ON work_execution_definitions
WHEN EXISTS (SELECT 1 FROM work_execution_runs WHERE definition_id = OLD.id)
BEGIN SELECT raise(ABORT, 'work_execution_definition_retained'); END;
