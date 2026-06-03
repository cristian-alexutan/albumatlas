import { Router } from "express";
import type { Request, Response } from "express";
import { service } from "../service.js";

export const statisticsRouter = Router();

// GET /api/statistics
statisticsRouter.get("/", (_req: Request, res: Response) => {
  res.json(service.statistics());
});
