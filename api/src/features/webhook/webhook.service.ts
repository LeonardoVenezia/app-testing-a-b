import { PrismaClient, TestStatus } from "@prisma/client";
import { tiendanubeApiClient } from "@config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool as any);
const prisma = new PrismaClient({ adapter });

class WebhookService {
  async handleOrderCreated(storeId: number, orderData: any) {
    if (!orderData.products || !Array.isArray(orderData.products)) return;

    for (const item of orderData.products) {
      await this.syncStockAndSales(storeId, item, "decrease");
    }
  }

  async handleOrderCancelled(storeId: number, orderData: any) {
    if (!orderData.products || !Array.isArray(orderData.products)) return;

    for (const item of orderData.products) {
      await this.syncStockAndSales(storeId, item, "increase");
    }
  }

  private async syncStockAndSales(
    storeId: number,
    item: any,
    action: "decrease" | "increase"
  ) {
    const productId = item.product_id;
    const quantity = item.quantity;
    if (!productId || !quantity) return;

    // Find if this product belongs to an active A/B test
    const test = await prisma.abTest.findFirst({
      where: {
        store_id: storeId,
        status: TestStatus.ACTIVE,
        OR: [
          { original_product_id: productId },
          { variant_product_id: productId },
        ],
      },
    });

    if (!test) return;

    // Determine the sibling product ID to sync stock
    const isOriginal = test.original_product_id === productId;
    const siblingProductId = isOriginal
      ? test.variant_product_id
      : test.original_product_id;

    // Determine sales metric field to update
    const salesField = isOriginal ? "original_sales" : "variant_sales";
    const salesIncrement = action === "decrease" ? quantity : -quantity;

    try {
      // 1. Update sales metric
      await prisma.abTest.update({
        where: { id: test.id },
        data: {
          [salesField]: {
             increment: salesIncrement
          }
        },
      });

      // 2. Sync stock on the sibling product
      // We fetch the sibling product to get its default variant ID
      const siblingProductData = await tiendanubeApiClient.get(
        `${storeId}/products/${siblingProductId}`
      ) as any;

      if (!siblingProductData || !siblingProductData.variants || !siblingProductData.variants.length) {
        return;
      }

      // We apply the change to the first variant of the sibling product (MVP simplification)
      const siblingVariant = siblingProductData.variants[0];
      if (siblingVariant.stock === null || siblingVariant.stock === undefined) {
        // Infinite stock
        return;
      }

      const newStock = action === "decrease" 
        ? Math.max(0, siblingVariant.stock - quantity)
        : siblingVariant.stock + quantity;

      await tiendanubeApiClient.put(
        `${storeId}/products/${siblingProductId}/variants/${siblingVariant.id}`,
        { stock: newStock }
      );
      
      console.log(`Synced stock for sibling product ${siblingProductId}. Action: ${action}, quantity: ${quantity}`);
    } catch (e: any) {
      console.error(`Failed to sync stock for sibling product ${siblingProductId}:`, e.message);
    }
  }
}

export default new WebhookService();
