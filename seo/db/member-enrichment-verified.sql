-- How the member's identity mapping was verified: 'kba' (knowledge-based questions), 'id'
-- (driver's-license / passport scan), or NULL (unverified self-assertion). Lightweight, non-gating.
ALTER TABLE member_enrichment ADD COLUMN IF NOT EXISTS verified_level TEXT
