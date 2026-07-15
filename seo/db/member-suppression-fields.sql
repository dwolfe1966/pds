-- Per-item suppression for the Identity Management product. Extends member_suppression:
--   activity_hidden — the global "Hide my activity on IDLookup" flag (was row-existence before).
--   hidden_fields   — exposure-driver keys the member has chosen to hide (location, past, relatives,
--                     employment, education, report). Enforced in WSFY (a hidden field's affinity is
--                     never surfaced about the member) and reflected in their exposure score.
-- Existing rows were created to hide activity, so activity_hidden backfills to true. Run once on Neon.
ALTER TABLE member_suppression ADD COLUMN IF NOT EXISTS activity_hidden BOOLEAN DEFAULT true;
ALTER TABLE member_suppression ADD COLUMN IF NOT EXISTS hidden_fields TEXT[] DEFAULT '{}';
UPDATE member_suppression SET activity_hidden = true WHERE activity_hidden IS NULL
