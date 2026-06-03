import { Router } from "express";
import type { Request, Response } from "express";

export const chatRouter = Router();

function sessionUser(req: Request) {
  return req.session;
}

chatRouter.get("/partners", async (req: Request, res: Response) => {
  const s = sessionUser(req);
  if (!s.userId) {
    res.status(401).json({ error: "Login required." });
    return;
  }

  if (!process.env.MONGODB_URL) {
    res.json({ users: [] });
    return;
  }

  try {
    const { getRecentPartnersWithNamesForUser } = await import("../mongodb.js");
    const users = await getRecentPartnersWithNamesForUser(s.userId, s.username ?? "");
    res.json({ users });
  } catch {
    res.json({ users: [] });
  }
});
