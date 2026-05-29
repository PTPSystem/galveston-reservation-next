-- Run this directly in Neon SQL Editor if prisma migrations are blocked by old drift

CREATE TABLE IF NOT EXISTS email_settings (
  id SERIAL PRIMARY KEY,
  property_manager_email TEXT NOT NULL,
  owner_email TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Optional: seed a default row (change the emails as needed)
INSERT INTO email_settings (property_manager_email, owner_email)
VALUES ('livingbayfront@gmail.com', 'livingbayfront@gmail.com')
ON CONFLICT (id) DO NOTHING;
