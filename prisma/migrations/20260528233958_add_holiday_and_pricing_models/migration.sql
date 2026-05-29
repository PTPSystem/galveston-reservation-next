-- CreateEnum
CREATE TYPE "BookingSource" AS ENUM ('DIRECT', 'VRBO');

-- AlterTable
ALTER TABLE "booking_requests" ADD COLUMN     "pricing" JSONB,
ADD COLUMN     "source" "BookingSource" NOT NULL DEFAULT 'DIRECT';

-- CreateTable
CREATE TABLE "pricing_adjustments" (
    "id" SERIAL NOT NULL,
    "booking_request_id" INTEGER NOT NULL,
    "adjustmentType" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "appliedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pricing_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "holiday_periods" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "rate" INTEGER NOT NULL DEFAULT 700,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "holiday_periods_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "pricing_adjustments" ADD CONSTRAINT "pricing_adjustments_booking_request_id_fkey" FOREIGN KEY ("booking_request_id") REFERENCES "booking_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
