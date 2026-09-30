CREATE TRIGGER system_record_retirement_plans_insert BEFORE INSERT ON system_record_retirement_plans
BEGIN
  SELECT RAISE(ABORT,'record_retirement_plan_conflict') WHERE EXISTS (
    SELECT 1 FROM system_record_retirement_plans WHERE id=NEW.id
  );
  SELECT RAISE(ABORT,'record_retirement_plan_freeze_unavailable') WHERE NOT EXISTS (
    SELECT 1 FROM system_record_source_freezes WHERE id=NEW.freeze_id AND revision=1
      AND source_namespace IS json_extract(NEW.snapshot_json,'$.sourceNamespace')
      AND owner_context IS json_extract(NEW.snapshot_json,'$.ownerContext')
      AND julianday(json_extract(snapshot_json,'$.createdAt')) <= julianday(json_extract(NEW.snapshot_json,'$.createdAt'))
  );
  SELECT RAISE(ABORT,'record_retirement_plan_coverage_invalid') WHERE EXISTS (
    SELECT 1 FROM json_each(NEW.snapshot_json,'$.coverage') c
    WHERE json_extract(c.value,'$.recordKind') IS NOT json_extract(NEW.snapshot_json,'$.capability.recordKinds[' || c.key || ']')
      OR NOT EXISTS (
        SELECT 1 FROM system_record_coverage_pages p
        WHERE p.id IS json_extract(c.value,'$.terminalPageId') AND p.freeze_id=NEW.freeze_id
          AND p.record_kind IS json_extract(c.value,'$.recordKind') AND p.next_cursor IS NULL
          AND p.digest IS json_extract(c.value,'$.terminalDigest')
          AND p.sequence IS json_extract(c.value,'$.pageCount')
          AND json_extract(p.snapshot_json,'$.purpose') IS json_extract(NEW.snapshot_json,'$.purpose')
          AND julianday(json_extract(p.snapshot_json,'$.checkedAt')) <= julianday(json_extract(NEW.snapshot_json,'$.createdAt'))
          AND (SELECT count(*) FROM system_record_coverage_entries e WHERE e.freeze_id=NEW.freeze_id AND e.record_kind=p.record_kind)
            IS json_extract(c.value,'$.recordCount')
      )
  );
  SELECT RAISE(ABORT,'record_retirement_plan_coverage_invalid') WHERE
    (SELECT count(DISTINCT json_extract(value,'$.recordKind')) FROM json_each(NEW.snapshot_json,'$.coverage'))
      <> json_array_length(NEW.snapshot_json,'$.coverage');
  SELECT RAISE(ABORT,'record_retirement_plan_audit_missing') WHERE NOT EXISTS (
    SELECT 1 FROM system_audit_events a WHERE a.event_id=NEW.audit_event_id
      AND a.action='system.record.retirement.plan.created' AND a.target_type='system:record-retirement-plan'
      AND a.target_id=NEW.id AND a.outcome='succeeded' AND a.before_json IS NULL
      AND a.actor_account_id IS json_extract(NEW.snapshot_json,'$.actorAccountId')
      AND a.after_json IS NEW.snapshot_json
      AND strftime('%Y-%m-%dT%H:%M:%fZ',a.occurred_at/1000.0,'unixepoch') IS json_extract(NEW.snapshot_json,'$.createdAt')
  );
END;
