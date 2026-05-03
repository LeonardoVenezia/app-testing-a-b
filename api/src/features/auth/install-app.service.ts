import { tiendanubeAuthClient, tiendanubeApiClient } from "@config";
import { BadRequestException } from "@utils";
import { userRepository } from "@repository";
import { TiendanubeAuthRequest, TiendanubeAuthInterface } from "@features/auth";

class InstallAppService {
  public async install(code: string): Promise<TiendanubeAuthInterface> {
    if (!code) {
      throw new BadRequestException("The authorization code not found");
    }

    const body: TiendanubeAuthRequest = {
      client_id: process.env.CLIENT_ID as string,
      client_secret: process.env.CLIENT_SECRET as string,
      grant_type: "authorization_code",
      code: code,
    };

    const authenticateResponse = await this.authenticateApp(body);

    // This condition will be true when the code has been used or is invalid.
    if (authenticateResponse.error && authenticateResponse.error_description) {
      throw new BadRequestException(
        authenticateResponse.error as string,
        authenticateResponse.error_description
      );
    }

    // Insert response of Authentication API at db.json file
    await userRepository.save(authenticateResponse);

    // Register webhooks in background (don't block the redirect)
    if (authenticateResponse.user_id) {
      this.registerWebhooks(authenticateResponse.user_id).catch(function(e) {
        console.error("[Webhooks] Background registration failed:", e);
      });
    }

    return authenticateResponse;
  }

  private async registerWebhooks(storeId: number) {
    const appUrl = process.env.APP_URL;
    if (!appUrl) {
      console.warn("[Webhooks] APP_URL not set, skipping webhook registration");
      return;
    }

    const webhooks = [
      { event: "order/created", url: `${appUrl}/webhooks/order-created` },
      { event: "order/paid", url: `${appUrl}/webhooks/order-paid` },
      { event: "order/cancelled", url: `${appUrl}/webhooks/order-cancelled` },
    ];

    for (const wh of webhooks) {
      try {
        await tiendanubeApiClient.post(`${storeId}/webhooks`, wh);
        console.log(`[Webhooks] Registered ${wh.event} for store ${storeId}`);
      } catch (e: any) {
        // 422 = already exists, which is fine
        if (e?.response?.status === 422) {
          console.log(`[Webhooks] ${wh.event} already registered for store ${storeId}`);
        } else {
          console.error(`[Webhooks] Failed to register ${wh.event}:`, e?.response?.data || e.message);
        }
      }
    }
  }

  private async authenticateApp(
    body: TiendanubeAuthRequest
  ): Promise<TiendanubeAuthInterface> {
    return tiendanubeAuthClient.post("/", body);
  }
}

export default new InstallAppService();
