CREATE TRIGGER system_record_retirement_receipts_insert BEFORE INSERT ON system_record_retirement_receipts
BEGIN
  SELECT RAISE(ABORT,'record_retirement_receipt_conflict') WHERE EXISTS (
    SELECT 1 FROM system_record_retirement_receipts WHERE id=NEW.id
      OR (plan_id=NEW.plan_id AND (ordinal>=NEW.ordinal OR coverage_page_id=NEW.coverage_page_id))
  );
  SELECT RAISE(ABORT,'record_retirement_receipt_plan_invalid') WHERE NOT EXISTS (
    SELECT 1 FROM system_record_retirement_plans plan
    JOIN system_record_source_freezes freeze ON freeze.id=plan.freeze_id AND freeze.revision=1
    JOIN json_each(plan.snapshot_json,'$.coverage') c
    JOIN system_record_coverage_pages page ON page.id=NEW.coverage_page_id
      AND page.freeze_id=plan.freeze_id AND page.record_kind IS json_extract(c.value,'$.recordKind')
    WHERE plan.id=NEW.plan_id AND plan.digest IS json_extract(NEW.snapshot_json,'$.planDigest')
      AND page.digest IS json_extract(NEW.snapshot_json,'$.coveragePageDigest')
      AND page.sequence <= json_extract(c.value,'$.pageCount')
      AND NEW.ordinal IS page.sequence + (SELECT coalesce(sum(json_extract(prior.value,'$.pageCount')),0)
        FROM json_each(plan.snapshot_json,'$.coverage') prior WHERE prior.key<c.key)
      AND julianday(json_extract(NEW.snapshot_json,'$.checkedAt')) >= julianday(json_extract(plan.snapshot_json,'$.createdAt'))
      AND julianday(json_extract(NEW.snapshot_json,'$.checkedAt')) >= julianday(json_extract(page.snapshot_json,'$.checkedAt'))
  );
  SELECT RAISE(ABORT,'record_retirement_receipt_order_invalid') WHERE
    (NEW.ordinal=1 AND json_type(NEW.snapshot_json,'$.previousReceiptDigest') IS NOT 'null')
    OR (NEW.ordinal>1 AND NOT EXISTS (
      SELECT 1 FROM system_record_retirement_receipts previous
      WHERE previous.plan_id=NEW.plan_id AND previous.ordinal=NEW.ordinal-1
        AND previous.digest IS json_extract(NEW.snapshot_json,'$.previousReceiptDigest')
        AND julianday(json_extract(NEW.snapshot_json,'$.checkedAt')) >= julianday(json_extract(previous.snapshot_json,'$.checkedAt'))
    ));
  SELECT RAISE(ABORT,'record_retirement_receipt_audit_missing') WHERE NOT EXISTS (
    SELECT 1 FROM system_audit_events a WHERE a.event_id=NEW.audit_event_id
      AND a.action='system.record.retirement.page.verified' AND a.target_type='system:record-retirement-receipt'
      AND a.target_id=NEW.id AND a.outcome='succeeded' AND a.before_json IS NULL
      AND a.actor_account_id IS json_extract(NEW.snapshot_json,'$.actorAccountId')
      AND a.after_json IS NEW.snapshot_json
      AND strftime('%Y-%m-%dT%H:%M:%fZ',a.occurred_at/1000.0,'unixepoch') IS json_extract(NEW.snapshot_json,'$.checkedAt')
  );
END;
