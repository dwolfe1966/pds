-- One-time: give fl_inmates a queryable county grain for the county-hub taxonomy
-- (/people/{state}/county/{county}/...). FL OBIS carries the county of conviction only inside the charge
-- text, e.g. "DRIV W/LIC S/R/C/D FELONY (MANATEE)". Extract the first parenthetical into a real column.
-- Already applied to the shared Neon 2026-07-20 (667,829 / 670,606 rows → 81 counties). Idempotent.
ALTER TABLE fl_inmates ADD COLUMN IF NOT EXISTS county text;
ALTER TABLE fl_inmates ADD COLUMN IF NOT EXISTS county_norm text;
UPDATE fl_inmates
  SET county = (regexp_match(offenses::text, '\(([A-Z][A-Z .''-]+)\)'))[1]
  WHERE offenses IS NOT NULL AND county IS NULL;
UPDATE fl_inmates SET county_norm = lower(trim(county)) WHERE county IS NOT NULL AND county_norm IS NULL;
CREATE INDEX IF NOT EXISTS idx_fl_county ON fl_inmates(county_norm);
