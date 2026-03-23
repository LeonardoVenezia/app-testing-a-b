import { Request, Response } from "express";
import * as fs from "fs";
import * as path from "path";
import prisma from "../../config/prisma";
import { TestStatus } from "@prisma/client";
import { tiendanubeApiClient } from "../../config/tiendanube-api.client";

class ScriptTagController {
  
  // GET /script-tag/storefront.js
  async serveScript(req: Request, res: Response) {
    const scriptPath = path.join(__dirname, "storefront-script.js");
    if (fs.existsSync(scriptPath)) {
      res.setHeader("Content-Type", "application/javascript");
      // Add generous cache because it's static
      res.setHeader("Cache-Control", "public, max-age=3600");
      res.status(200).send(fs.readFileSync(scriptPath, "utf8"));
    } else {
      res.status(404).send("Not found");
    }
  }

  // GET /script-tag/config/:storeId
  async getConfig(req: Request, res: Response) {
    const storeId = Number(req.params.storeId);
    if (!storeId) {
      return res.status(400).send([]);
    }

    try {
      const tests = await prisma.abTest.findMany({
        where: {
          store_id: storeId,
          status: TestStatus.ACTIVE
        },
        select: {
          id: true,
          original_product_id: true,
          variant_product_id: true
        }
      });
      res.json(tests);
    } catch(e) {
      console.error("Error fetching ScriptTag config:", e);
      res.status(500).json([]);
    }
  }

  // POST /script-tag/config/:storeId/log-view
  async logView(req: Request, res: Response) {
     const { test_id, group } = req.body;
     if (!test_id || !group) {
        return res.status(400).send("Invalid input");
     }

     try {
       const field = group === "A" ? "original_views" : "variant_views";
       await prisma.abTest.update({
         where: { id: test_id },
         data: { [field]: { increment: 1 } }
       });
       res.status(200).send("OK");
     } catch (e) {
       console.error("Error logging ScriptTag view:", e);
       res.status(500).send("Error");
     }
  }
  // GET /script-tag/debug/:storeId — list all registered scripts with Tiendanube
  async debugListScripts(req: Request, res: Response) {
    const storeId = req.params.storeId;
    try {
      const result = await tiendanubeApiClient.get(`${storeId}/scripts`);
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e.response?.data || e.message });
    }
  }
}

export default new ScriptTagController();
