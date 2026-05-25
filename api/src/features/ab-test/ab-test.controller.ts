import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { BadRequestException, StatusCode } from "@utils";
import AbTestService from "./ab-test.service";
import { TestStatus } from "@prisma/client";
import { createAbTestSchema, updateAbTestStatusSchema } from "./ab-test.schemas";

export interface AuthenticatedRequest extends Request {
  user: { user_id: number };
}

function toBadRequest(err: ZodError): BadRequestException {
  const first = err.issues[0];
  const path = first?.path?.join(".") || "input";
  return new BadRequestException(
    `Datos inválidos: ${path} — ${first?.message || "validation failed"}`,
    JSON.stringify(err.issues)
  );
}

class AbTestController {
  async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const parsed = createAbTestSchema.safeParse(req.body);
      if (!parsed.success) return next(toBadRequest(parsed.error));
      const data = await AbTestService.create(req.user.user_id, parsed.data);
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
      const parsed = updateAbTestStatusSchema.safeParse(req.body);
      if (!parsed.success) return next(toBadRequest(parsed.error));
      const data = await AbTestService.updateStatus(
        req.user.user_id,
        req.params.id,
        parsed.data.status as TestStatus
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
