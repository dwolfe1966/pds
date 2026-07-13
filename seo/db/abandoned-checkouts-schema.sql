-- Abandoned-checkout events (the highest-intent recovery audience). Fired by the
-- consumer's existing checkout_abandoned signal → POST /api/checkout-abandoned → here.
-- Run once on the SEO Neon DB (same DB as `leads`, or LEADS_DATABASE_URL).
-- emailed_at / recovered_at support the future recovery-email workflow.

CREATE TABLE IF NOT EXISTS abandoned_checkouts (
  id           BIGSERIAL PRIMARY KEY,
  email        TEXT,                        -- captured at signup (may be null)
  person_id    TEXT,                        -- the report they were unlocking
  offer        TEXT,                        -- offer/price key
  variant      TEXT,                        -- funnel variant
  meta         JSONB DEFAULT '{}'::jsonb,
  abandoned_at TIMESTAMPTZ,                 -- client timestamp
  received_at  TIMESTAMPTZ DEFAULT now(),
  ip           TEXT,
  user_agent   TEXT,
  emailed_at   TIMESTAMPTZ,                 -- set when the 1st recovery email is sent
  followup_at  TIMESTAMPTZ,                 -- set when the single follow-up is sent
  recovered_at TIMESTAMPTZ                  -- set if they later convert
);

-- If the table pre-existed without followup_at, add it.
ALTER TABLE abandoned_checkouts ADD COLUMN IF NOT EXISTS followup_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_abandoned_email    ON abandoned_checkouts (email);
CREATE INDEX IF NOT EXISTS idx_abandoned_received ON abandoned_checkouts (received_at);
-- "needs the 1st recovery email" queue: has an email, not yet emailed, not recovered.
CREATE INDEX IF NOT EXISTS idx_abandoned_pending  ON abandoned_checkouts (abandoned_at) WHERE emailed_at IS NULL AND email IS NOT NULL AND recovered_at IS NULL;
-- "needs the follow-up" queue: 1st email sent, follow-up not yet sent, not recovered.
CREATE INDEX IF NOT EXISTS idx_abandoned_followup ON abandoned_checkouts (emailed_at) WHERE emailed_at IS NOT NULL AND followup_at IS NULL AND recovered_at IS NULL;
