import { Router } from "express";
import type { Request, Response } from "express";
import { generator } from "../generator.js";
import { requireRole } from "../auth/auth-middleware.js";

export const generatorRouter = Router();

// POST /api/generator/start
generatorRouter.post("/start", requireRole("ADMIN"), (req: Request, res: Response) => {
  if (generator.running) {
    res.status(409).json({ error: "Generator already running" });
    return;
  }
  generator.start();
  res.json({ status: "started" });
});

// POST /api/generator/stop
generatorRouter.post("/stop", requireRole("ADMIN"), (req: Request, res: Response) => {
  if (!generator.running) {
    res.status(409).json({ error: "Generator is not running" });
    return;
  }
  generator.stop();
  res.json({ status: "stopped" });
});

// GET /api/generator/status
generatorRouter.get("/status", requireRole("ADMIN"), (req: Request, res: Response) => {
  res.json({ running: generator.running });
});
