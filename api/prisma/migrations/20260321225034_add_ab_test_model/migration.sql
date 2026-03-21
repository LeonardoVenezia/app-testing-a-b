-- CreateEnum
CREATE TYPE "TestStatus" AS ENUM ('ACTIVE', 'PAUSED', 'FINISHED');

-- CreateTable
CREATE TABLE "Store" (
    "user_id" INTEGER NOT NULL,
    "access_token" TEXT,
    "token_type" TEXT,
    "scope" TEXT,
    "error" TEXT,
    "error_description" TEXT,

    CONSTRAINT "Store_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "AbTest" (
    "id" TEXT NOT NULL,
    "store_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "status" "TestStatus" NOT NULL DEFAULT 'ACTIVE',
    "original_product_id" INTEGER NOT NULL,
    "variant_product_id" INTEGER NOT NULL,
    "original_views" INTEGER NOT NULL DEFAULT 0,
    "variant_views" INTEGER NOT NULL DEFAULT 0,
    "original_sales" INTEGER NOT NULL DEFAULT 0,
    "variant_sales" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AbTest_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "AbTest" ADD CONSTRAINT "AbTest_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "Store"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
