-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('PAGE_VIEW', 'TIME_ON_PAGE', 'IMAGE_CLICK', 'DESCRIPTION_INTERACTION', 'ADD_TO_CART', 'CHECKOUT_STARTED', 'ORDER_COMPLETED', 'ORDER_PAID');

-- AlterTable
ALTER TABLE "AbTest" ADD COLUMN     "original_revenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "variant_revenue" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "TrackingEvent" (
    "id" TEXT NOT NULL,
    "test_id" TEXT NOT NULL,
    "variant" TEXT NOT NULL,
    "event_type" "EventType" NOT NULL,
    "session_id" TEXT NOT NULL,
    "payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrackingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TrackingEvent_test_id_event_type_idx" ON "TrackingEvent"("test_id", "event_type");

-- CreateIndex
CREATE INDEX "TrackingEvent_test_id_session_id_event_type_idx" ON "TrackingEvent"("test_id", "session_id", "event_type");

-- CreateIndex
CREATE INDEX "TrackingEvent_session_id_idx" ON "TrackingEvent"("session_id");

-- AddForeignKey
ALTER TABLE "TrackingEvent" ADD CONSTRAINT "TrackingEvent_test_id_fkey" FOREIGN KEY ("test_id") REFERENCES "AbTest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
