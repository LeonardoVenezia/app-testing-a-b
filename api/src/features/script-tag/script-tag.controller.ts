import { Request, Response } from "express";
import { PrismaClient, TestStatus } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

// Boilerplate for native Postgres client
const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool as any);
const prisma = new PrismaClient({ adapter });

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
}

export default new ScriptTagController();
