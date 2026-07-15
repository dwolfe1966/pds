-- Per-module Protect/Promote dispositions for the modular My Profile. Map of moduleId → 'protect' |
-- 'promote' (neutral is the absence of a key). Lives alongside the existing suppression state.
-- 'protect' = hide from others; 'promote' = feature publicly; drives the viewer projection.
ALTER TABLE member_suppression ADD COLUMN IF NOT EXISTS dispositions JSONB DEFAULT '{}'::jsonb
