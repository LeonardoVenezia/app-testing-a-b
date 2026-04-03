import prisma from "../../config/prisma";
import { TestStatus } from "@prisma/client";
import { tiendanubeApiClient } from "@config";
import trackingRepository from "../tracking/tracking.repository";

class WebhookService {
  async handleOrderCreated(storeId: number, orderData: any) {
    if (!orderData.products || !Array.isArray(orderData.products)) return;

    for (const item of orderData.products) {
      await this.processOrderItem(storeId, orderData, item, "created");
    }
  }

  async handleOrderCancelled(storeId: number, orderData: any) {
    if (!orderData.products || !Array.isArray(orderData.products)) return;

    for (const item of orderData.products) {
      await this.syncStockOnCancel(storeId, item);
    }
  }

  // Called externally if you register order/paid webhook
  async handleOrderPaid(storeId: number, orderData: any) {
    if (!orderData.products || !Array.isArray(orderData.products)) return;

    for (const item of orderData.products) {
      await this.processOrderItem(storeId, orderData, item, "paid");
    }
  }

  private async processOrderItem(
    storeId: number,
    orderData: any,
    item: any,
    stage: "created" | "paid"
  ) {
    const productId = item.product_id;
    const quantity = item.quantity || 1;
    const itemRevenue = parseFloat(item.price || "0") * quantity;
    if (!productId) return;

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

    const isOriginal = test.original_product_id === productId;
    const variant = isOriginal ? "A" : "B";
    const eventType = stage === "created" ? "ORDER_COMPLETED" : "ORDER_PAID";

    // Try to find session_id from a previous tracking event for this customer
    // Use order customer_id or email as fallback session lookup
    let sessionId = "webhook_" + (orderData.id || Date.now());

    // Attempt attribution: look for a recent session that interacted with this test
    if (orderData.customer?.id) {
      // Check if there's a stored session from the storefront
      const recentEvent = await prisma.trackingEvent.findFirst({
        where: {
          test_id: test.id,
          variant,
          event_type: { in: ["ADD_TO_CART", "CHECKOUT_STARTED", "PAGE_VIEW"] },
        },
        orderBy: { created_at: "desc" },
        select: { session_id: true },
      });
      if (recentEvent) sessionId = recentEvent.session_id;
    }

    // Record the tracking event
    await trackingRepository.recordEvent({
      test_id: test.id,
      variant,
      event_type: eventType as any,
      session_id: sessionId,
      payload: {
        order_id: orderData.id,
        revenue: itemRevenue,
        quantity,
        product_id: productId,
      },
    });

    // Update legacy counters
    if (stage === "created") {
      const salesField = isOriginal ? "original_sales" : "variant_sales";
      const revenueField = isOriginal ? "original_revenue" : "variant_revenue";
      await prisma.abTest.update({
        where: { id: test.id },
        data: {
          [salesField]: { increment: quantity },
          [revenueField]: { increment: itemRevenue },
        },
      });

      // Sync stock on sibling
      await this.syncSiblingStock(storeId, test, productId, quantity, "decrease");
    }
  }

  private async syncStockOnCancel(storeId: number, item: any) {
    const productId = item.product_id;
    const quantity = item.quantity || 1;
    if (!productId) return;

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

    const isOriginal = test.original_product_id === productId;
    const salesField = isOriginal ? "original_sales" : "variant_sales";
    const revenueField = isOriginal ? "original_revenue" : "variant_revenue";
    const itemRevenue = parseFloat(item.price || "0") * quantity;

    await prisma.abTest.update({
      where: { id: test.id },
      data: {
        [salesField]: { increment: -quantity },
        [revenueField]: { increment: -itemRevenue },
      },
    });

    await this.syncSiblingStock(storeId, test, productId, quantity, "increase");
  }

  private async syncSiblingStock(
    storeId: number,
    test: any,
    productId: number,
    quantity: number,
    action: "decrease" | "increase"
  ) {
    const isOriginal = test.original_product_id === productId;
    const siblingId = isOriginal ? test.variant_product_id : test.original_product_id;

    try {
      const sibling = (await tiendanubeApiClient.get(
        `${storeId}/products/${siblingId}`
      )) as any;

      if (!sibling?.variants?.length) return;

      const sv = sibling.variants[0];
      if (sv.stock === null || sv.stock === undefined) return;

      const newStock =
        action === "decrease"
          ? Math.max(0, sv.stock - quantity)
          : sv.stock + quantity;

      await tiendanubeApiClient.put(
        `${storeId}/products/${siblingId}/variants/${sv.id}`,
        { stock: newStock }
      );
    } catch (e: any) {
      console.error(`Failed to sync stock for sibling ${siblingId}:`, e.message);
    }
  }
}

export default new WebhookService();
