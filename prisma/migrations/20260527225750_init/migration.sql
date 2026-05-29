-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CONFIRMED', 'CANCELLED');

-- CreateTable
CREATE TABLE "booking_requests" (
    "id" SERIAL NOT NULL,
    "guest_name" TEXT NOT NULL,
    "guest_email" TEXT NOT NULL,
    "guest_phone" TEXT,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "num_guests" INTEGER NOT NULL DEFAULT 1,
    "special_requests" TEXT,
    "status" "BookingStatus" NOT NULL DEFAULT 'PENDING',
    "approval_token" TEXT,
    "rejection_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "approved_at" TIMESTAMP(3),
    "rejected_at" TIMESTAMP(3),
    "google_event_id" TEXT,

    CONSTRAINT "booking_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_events" (
    "id" SERIAL NOT NULL,
    "google_event_id" TEXT NOT NULL,
    "summary" TEXT,
    "description" TEXT,
    "start_datetime" TIMESTAMP(3) NOT NULL,
    "end_datetime" TIMESTAMP(3) NOT NULL,
    "status" TEXT,
    "source" TEXT NOT NULL DEFAULT 'google',
    "booking_request_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "last_synced" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calendar_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_logs" (
    "id" SERIAL NOT NULL,
    "sync_type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "events_processed" INTEGER NOT NULL DEFAULT 0,
    "events_added" INTEGER NOT NULL DEFAULT 0,
    "events_updated" INTEGER NOT NULL DEFAULT 0,
    "events_removed" INTEGER NOT NULL DEFAULT 0,
    "discrepancies_found" INTEGER NOT NULL DEFAULT 0,
    "message" TEXT,
    "error_details" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "booking_requests_approval_token_key" ON "booking_requests"("approval_token");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_events_google_event_id_key" ON "calendar_events"("google_event_id");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_events_booking_request_id_key" ON "calendar_events"("booking_request_id");

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_booking_request_id_fkey" FOREIGN KEY ("booking_request_id") REFERENCES "booking_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;
