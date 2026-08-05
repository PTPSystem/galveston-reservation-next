-- Run this in Neon SQL Editor if not using prisma db push

ALTER TABLE rate_settings
  ADD COLUMN IF NOT EXISTS min_nights INTEGER NOT NULL DEFAULT 2;
