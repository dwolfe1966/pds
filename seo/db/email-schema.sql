-- Email platform — send log + CAN-SPAM suppression (first-party marketing/lifecycle; BC keeps
-- transactional). Read/written by seo/lib/email/emails-db.mjs. Run once on Neon (idempotent).
CREATE TABLE IF NOT EXISTS email_sends (
  id          BIGSERIAL PRIMARY KEY,
  email       TEXT NOT NULL,
  campaign    TEXT NOT NULL,       -- 'checkout_abandoned' | 'welcome' | 'wsfy_alert' | 'adhoc' | ...
  subject     TEXT,
  status      TEXT,                -- 'sent' | 'suppressed' | 'error'
  provider_id TEXT,                -- SendGrid x-message-id
  meta        JSONB DEFAULT '{}'::jsonb,
  sent_at     TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_email_sends_email    ON email_sends(email);
CREATE INDEX IF NOT EXISTS idx_email_sends_campaign ON email_sends(campaign);

CREATE TABLE IF NOT EXISTS email_suppression (
  email         TEXT PRIMARY KEY,  -- normalized lowercase
  reason        TEXT,              -- 'unsubscribe' | 'bounce' | 'complaint' | 'manual'
  source        TEXT,
  suppressed_at TIMESTAMPTZ DEFAULT now()
);
