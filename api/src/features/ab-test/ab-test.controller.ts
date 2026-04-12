import { NextFunction, Request, Response } from "express";
import { StatusCode } from "@utils";
import AbTestService from "./ab-test.service";
import { TestStatus } from "@prisma/client";

export interface AuthenticatedRequest extends Request {
  user: { user_id: number };
}

class AbTestController {
  async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = await AbTestService.create(req.user.user_id, req.body);
      return res.status(StatusCode.CREATED).json(data);
    } catch (e) {
      next(e);
    }
  }

  async getAll(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = await AbTestService.findAll(req.user.user_id);
      return res.status(StatusCode.OK).json(data);
    } catch (e) {
      next(e);
    }
  }

  async getOne(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = await AbTestService.findOne(
        req.user.user_id,
        req.params.id
      );
      return res.status(StatusCode.OK).json(data);
    } catch (e) {
      next(e);
    }
  }

  async updateStatus(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { status } = req.body;
      const data = await AbTestService.updateStatus(
        req.user.user_id,
        req.params.id,
        status as TestStatus
      );
      return res.status(StatusCode.OK).json(data);
    } catch (e) {
      next(e);
    }
  }

  async delete(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      await AbTestService.delete(req.user.user_id, req.params.id);
      return res.status(StatusCode.OK).json({ success: true });
    } catch (e) {
      next(e);
    }
  }

  async getDeleted(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = await AbTestService.findDeleted(req.user.user_id);
      return res.status(StatusCode.OK).json(data);
    } catch (e) {
      next(e);
    }
  }
}

export default new AbTestController();
