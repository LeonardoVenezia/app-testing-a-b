import { tiendanubeBillingClient, tiendanubeApiClient } from "@config";
import {
    IPlan,
    ICreatePlanRequest,
    IUpdatePlanRequest,
    ISubscription,
    IUpdateSubscriptionRequest,
} from "./billing.interfaces";

class BillingService {
    /**
     * --- PLANS (Uses Partner-Action Auth via tiendanubeBillingClient) ---
     * Note: The base URL for tiendanubeBillingClient must be configured to point to
     * https://api.tiendanube.com/v1/apps/{app_id} or equivalent for Partner-Actions.
     */

    async createPlan(data: ICreatePlanRequest): Promise<IPlan> {
        return await tiendanubeBillingClient.post("/plans", data);
    }

    async updatePlan(planId: string, data: IUpdatePlanRequest): Promise<IPlan> {
        return await tiendanubeBillingClient.patch(`/plans/${planId}`, data);
    }

    async deletePlan(planId: string): Promise<any> {
        return await tiendanubeBillingClient.delete(`/plans/${planId}`);
    }

    /**
     * --- SUBSCRIPTIONS (Uses Standard Auth via tiendanubeApiClient) ---
     * Note: Subscriptions are tied to the store, so we use tiendanubeApiClient
     * which automatically injects the store's access_token.
     */

    async getSubscription(
        storeId: number,
        appId: string,
        conceptCode: string
    ): Promise<ISubscription> {
        return await tiendanubeApiClient.get(
            `${storeId}/concepts/${conceptCode}/services/${appId}/subscriptions`
        );
    }

    async updateSubscription(
        storeId: number,
        appId: string,
        conceptCode: string,
        data: IUpdateSubscriptionRequest
    ): Promise<ISubscription> {
        return await tiendanubeApiClient.patch(
            `${storeId}/concepts/${conceptCode}/services/${appId}/subscriptions`,
            data
        );
    }
}

export default new BillingService();
