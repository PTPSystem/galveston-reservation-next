-- Remember VRBO reservation IDs the admin deleted from Manual Match.
-- Safe additive migration (new table only).

CREATE TABLE IF NOT EXISTS "vrbo_ignored_reservations" (
    "id" SERIAL NOT NULL,
    "reservation_id" TEXT NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vrbo_ignored_reservations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "vrbo_ignored_reservations_reservation_id_key"
  ON "vrbo_ignored_reservations"("reservation_id");
