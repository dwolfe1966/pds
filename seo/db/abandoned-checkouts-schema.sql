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
  emailed_at   TIMESTAMPTZ,                 -- set when a recovery email is sent (future)
  recovered_at TIMESTAMPTZ                  -- set if they later convert (future)
);

CREATE INDEX IF NOT EXISTS idx_abandoned_email    ON abandoned_checkouts (email);
CREATE INDEX IF NOT EXISTS idx_abandoned_received ON abandoned_checkouts (received_at);
-- "needs a recovery email" queue: has an email, not yet emailed.
CREATE INDEX IF NOT EXISTS idx_abandoned_pending  ON abandoned_checkouts (received_at) WHERE emailed_at IS NULL AND email IS NOT NULL;
