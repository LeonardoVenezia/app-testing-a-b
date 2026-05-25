-- CreateTable
CREATE TABLE "WebhookDlq" (
    "id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "store_id" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "next_retry_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebhookDlq_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WebhookDlq_resolved_next_retry_at_idx" ON "WebhookDlq"("resolved", "next_retry_at");

-- CreateIndex
CREATE INDEX "WebhookDlq_store_id_idx" ON "WebhookDlq"("store_id");
