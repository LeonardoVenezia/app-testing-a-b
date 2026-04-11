import prisma from "../../config/prisma";
import { TestStatus } from "@prisma/client";
import { tiendanubeApiClient } from "@config";
import trackingRepository from "../tracking/tracking.repository";

class WebhookService {
  /**
   * Fetch full order from Tiendanube API since webhook payloads
   * only contain a minimal summary (id, store_id) without products.
   */
  private async fetchFullOrder(storeId: number, orderId: number): Promise<any | null> {
    try {
      return await tiendanubeApiClient.get(`${storeId}/orders/${orderId}`) as any;
    } catch (e: any) {
      console.error(`[Webhook] Failed to fetch order ${orderId} for store ${storeId}:`, e.message);
      return null;
    }
  }

  async handleOrderCreated(storeId: number, webhookPayload: any) {
    console.log(`[Webhook] order/created received for store ${storeId}:`, JSON.stringify(webhookPayload));
    const orderId = webhookPayload.id;
    if (!orderId) { console.warn('[Webhook] No order ID in payload'); return; }

    const order = await this.fetchFullOrder(storeId, orderId);
    if (!order?.products?.length) { console.warn(`[Webhook] Order ${orderId} has no products or fetch failed`); return; }

    for (const item of order.products) {
      await this.processOrderItem(storeId, order, item, "created");
    }
  }

  async handleOrderCancelled(storeId: number, webhookPayload: any) {
    console.log(`[Webhook] order/cancelled received for store ${storeId}:`, JSON.stringify(webhookPayload));
    const orderId = webhookPayload.id;
    if (!orderId) { console.warn('[Webhook] No order ID in payload'); return; }

    const order = await this.fetchFullOrder(storeId, orderId);
    if (!order?.products?.length) { console.warn(`[Webhook] Order ${orderId} has no products or fetch failed`); return; }

    for (const item of order.products) {
      await this.syncStockOnCancel(storeId, item);
    }
  }

  async handleOrderPaid(storeId: number, webhookPayload: any) {
    console.log(`[Webhook] order/paid received for store ${storeId}:`, JSON.stringify(webhookPayload));
    const orderId = webhookPayload.id;
    if (!orderId) { console.warn('[Webhook] No order ID in payload'); return; }

    const order = await this.fetchFullOrder(storeId, orderId);
    if (!order?.products?.length) { console.warn(`[Webhook] Order ${orderId} has no products or fetch failed`); return; }

    for (const item of order.products) {
      await this.processOrderItem(storeId, order, item, "paid");
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

    // Attribute this order to a storefront session.
    // Priority: CHECKOUT_STARTED > ADD_TO_CART > PAGE_VIEW (most recent within 24h)
    let sessionId = "webhook_" + (orderData.id || Date.now());
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const recentEvent = await prisma.trackingEvent.findFirst({
      where: {
        test_id: test.id,
        variant,
        event_type: { in: ["CHECKOUT_STARTED", "ADD_TO_CART", "PAGE_VIEW"] },
        created_at: { gte: oneDayAgo },
      },
      orderBy: [
        // Prefer the deepest funnel event first, then most recent
        { event_type: "desc" },
        { created_at: "desc" },
      ],
      select: { session_id: true },
    });
    if (recentEvent && !recentEvent.session_id.startsWith("webhook_")) {
      sessionId = recentEvent.session_id;
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
