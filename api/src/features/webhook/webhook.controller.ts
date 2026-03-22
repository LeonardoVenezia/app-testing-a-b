import { Request, Response } from "express";
import WebhookService from "./webhook.service";
import { StatusCode } from "@utils";

class WebhookController {
  async handleOrderCreated(req: Request, res: Response) {
    try {
      // Extract store_id from either the headers or the payload body
      const storeId = Number(
        req.headers["x-tiendanube-store-id"] || 
        req.headers["x-link-store-id"] || 
        req.body?.store_id
      );
      
      if (!storeId) {
        return res.status(StatusCode.BAD_REQUEST).send("Missing store ID");
      }

      // Webhooks should respond 200 immediately to acknowledge
      res.status(StatusCode.OK).send("Acknowledged");

      // Process asynchronously
      await WebhookService.handleOrderCreated(storeId, req.body);
    } catch (e) {
      console.error("Error handling order/created webhook:", e);
    }
  }

  async handleOrderCancelled(req: Request, res: Response) {
    try {
      const storeId = Number(
        req.headers["x-tiendanube-store-id"] || 
        req.headers["x-link-store-id"] || 
        req.body?.store_id
      );

      if (!storeId) {
        return res.status(StatusCode.BAD_REQUEST).send("Missing store ID");
      }

      res.status(StatusCode.OK).send("Acknowledged");

      await WebhookService.handleOrderCancelled(storeId, req.body);
    } catch (e) {
      console.error("Error handling order/cancelled webhook:", e);
    }
  }
}

export default new WebhookController();
