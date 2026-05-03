import { NextFunction, Request, Response } from "express";
import { StatusCode } from "@utils";
import { InstallAppService, AuthService } from "@features/auth";
import { tiendanubeApiClient } from "@config";

class AuthenticationController {
  async install(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> {
    try {
      const data = await InstallAppService.install(
        req.query.code as string
      );

      const storeId = data.user_id;
      const storeInfo: any = await tiendanubeApiClient.get(`${storeId}/store`);
      const domain = storeInfo.url_with_protocol || storeInfo.main_domain || storeInfo.original_domain;

      if (domain) {
        const adminUrl = domain.replace(/\/$/, "") + `/admin/apps/${process.env.CLIENT_ID}`;
        return res.redirect(adminUrl);
      }

      return res.status(StatusCode.OK).json({ success: true });
    } catch (e) {
      return next(e);
    }
  }
  async login(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> {
    try {
      const data = await AuthService.login(req.body);
      return res.status(StatusCode.OK).json(data);
    } catch (e) {
      return next(e);
    }
  }
}

export default new AuthenticationController();
