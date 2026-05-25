import { Request, Response } from "express";
import WebhookService from "./webhook.service";
import webhookDlqRepository from "./webhook-dlq.repository";
import { StatusCode } from "@utils";

function extractStoreId(req: Request): number {
  return Number(
    req.headers["x-tiendanube-store-id"] ||
    req.headers["x-link-store-id"] ||
    req.body?.store_id
  );
}

// Process in the background after acknowledging the webhook. Any error gets
// parked in the DLQ so the worker can retry it instead of dropping the event.
async function processOrPark(eventType: string, storeId: number, payload: any) {
  try {
    await WebhookService.dispatch(eventType, storeId, payload);
  } catch (e: any) {
    const msg = e?.message || String(e);
    console.error(`[Webhook] ${eventType} processing failed, parking in DLQ:`, msg);
    try {
      await webhookDlqRepository.enqueue(eventType, storeId, payload, msg);
    } catch (dlqErr: any) {
      console.error(`[Webhook] ✗ Could not enqueue DLQ entry for ${eventType}:`, dlqErr?.message);
    }
  }
}

class WebhookController {
  async handleOrderCreated(req: Request, res: Response) {
    const storeId = extractStoreId(req);
    console.log(`[Webhook] ▶ order/created arrived storeId=${storeId} orderId=${req.body?.id}`);
    if (!storeId) return res.status(StatusCode.BAD_REQUEST).send("Missing store ID");
    res.status(StatusCode.OK).send("Acknowledged");
    processOrPark("order/created", storeId, req.body);
  }

  async handleOrderPaid(req: Request, res: Response) {
    const storeId = extractStoreId(req);
    console.log(`[Webhook] ▶ order/paid arrived storeId=${storeId} orderId=${req.body?.id}`);
    if (!storeId) return res.status(StatusCode.BAD_REQUEST).send("Missing store ID");
    res.status(StatusCode.OK).send("Acknowledged");
    processOrPark("order/paid", storeId, req.body);
  }

  async handleOrderCancelled(req: Request, res: Response) {
    const storeId = extractStoreId(req);
    console.log(`[Webhook] ▶ order/cancelled arrived storeId=${storeId} orderId=${req.body?.id}`);
    if (!storeId) return res.status(StatusCode.BAD_REQUEST).send("Missing store ID");
    res.status(StatusCode.OK).send("Acknowledged");
    processOrPark("order/cancelled", storeId, req.body);
  }
}

export default new WebhookController();
