import { NextFunction, Request, Response } from "express";
import { StatusCode } from "@utils";
import BillingService from "./billing.service";
import { DEFAULT_CONCEPT_CODE } from "./billing.constants";

export interface BillingRequest extends Request {
    user: { user_id: number };
}

class BillingController {
    // --- PLANS ---
    async createPlan(
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<Response | void> {
        try {
            const data = await BillingService.createPlan(req.body);
            return res.status(StatusCode.CREATED).json(data);
        } catch (e) {
            next(e);
        }
    }

    async updatePlan(
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<Response | void> {
        try {
            const data = await BillingService.updatePlan(req.params.id, req.body);
            return res.status(StatusCode.OK).json(data);
        } catch (e) {
            next(e);
        }
    }

    async deletePlan(
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<Response | void> {
        try {
            const data = await BillingService.deletePlan(req.params.id);
            return res.status(StatusCode.OK).json(data);
        } catch (e) {
            next(e);
        }
    }

    // --- SUBSCRIPTIONS ---
    async getSubscription(
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<Response | void> {
        try {
            // Req.user should be populated by passport JWT middleware
            const storeId = +(req.user as any).user_id;
            const appId = process.env.CLIENT_ID as string;
            const conceptCode = DEFAULT_CONCEPT_CODE;

            const data = await BillingService.getSubscription(
                storeId,
                appId,
                conceptCode
            );
            return res.status(StatusCode.OK).json(data);
        } catch (e) {
            next(e);
        }
    }

    async updateSubscription(
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<Response | void> {
        try {
            const storeId = +(req.user as any).user_id;
            const appId = process.env.CLIENT_ID as string;
            const conceptCode = DEFAULT_CONCEPT_CODE;

            const data = await BillingService.updateSubscription(
                storeId,
                appId,
                conceptCode,
                req.body
            );
            return res.status(StatusCode.OK).json(data);
        } catch (e) {
            next(e);
        }
    }
}

export default new BillingController();
