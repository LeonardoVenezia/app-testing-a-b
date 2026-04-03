import { Request, Response } from "express";
import WebhookService from "./webhook.service";
import { StatusCode } from "@utils";

function extractStoreId(req: Request): number {
  return Number(
    req.headers["x-tiendanube-store-id"] ||
    req.headers["x-link-store-id"] ||
    req.body?.store_id
  );
}

class WebhookController {
  async handleOrderCreated(req: Request, res: Response) {
    try {
      const storeId = extractStoreId(req);
      if (!storeId) return res.status(StatusCode.BAD_REQUEST).send("Missing store ID");
      res.status(StatusCode.OK).send("Acknowledged");
      await WebhookService.handleOrderCreated(storeId, req.body);
    } catch (e) {
      console.error("Error handling order/created webhook:", e);
    }
  }

  async handleOrderPaid(req: Request, res: Response) {
    try {
      const storeId = extractStoreId(req);
      if (!storeId) return res.status(StatusCode.BAD_REQUEST).send("Missing store ID");
      res.status(StatusCode.OK).send("Acknowledged");
      await WebhookService.handleOrderPaid(storeId, req.body);
    } catch (e) {
      console.error("Error handling order/paid webhook:", e);
    }
  }

  async handleOrderCancelled(req: Request, res: Response) {
    try {
      const storeId = extractStoreId(req);
      if (!storeId) return res.status(StatusCode.BAD_REQUEST).send("Missing store ID");
      res.status(StatusCode.OK).send("Acknowledged");
      await WebhookService.handleOrderCancelled(storeId, req.body);
    } catch (e) {
      console.error("Error handling order/cancelled webhook:", e);
    }
  }
}

export default new WebhookController();
