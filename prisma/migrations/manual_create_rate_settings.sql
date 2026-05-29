-- Run this in Neon SQL Editor

CREATE TABLE IF NOT EXISTS rate_settings (
  id SERIAL PRIMARY KEY,
  weekday_rate INTEGER NOT NULL DEFAULT 500,
  weekend_rate INTEGER NOT NULL DEFAULT 650,
  holiday_rate INTEGER NOT NULL DEFAULT 700,
  weekly_discount INTEGER NOT NULL DEFAULT 350,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default rates if table is empty
INSERT INTO rate_settings (weekday_rate, weekend_rate, holiday_rate, weekly_discount)
SELECT 500, 650, 700, 350
WHERE NOT EXISTS (SELECT 1 FROM rate_settings);
