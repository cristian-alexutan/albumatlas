import { Router } from "express";
import type { Request, Response } from "express";

export const usersRouter = Router();

function getPrisma() {
  if (!process.env.DATABASE_URL) return null;
  return import("../prisma-client.js").then((m) => m.prismaClient);
}

function sessionUser(req: Request) {
  return req.session;
}

usersRouter.get("/", async (req: Request, res: Response) => {
  const s = sessionUser(req);
  if (!s.userId) {
    res.status(401).json({ error: "Login required." });
    return;
  }

  const search = String(req.query.search ?? "").trim();
  if (search.length < 2) {
    res.json({ users: [] });
    return;
  }

  const prisma = await getPrisma();
  if (!prisma) {
    res.status(503).json({ error: "Database not available." });
    return;
  }

  const users = await prisma.user.findMany({
    where: {
      username: { contains: search, mode: "insensitive" },
    },
    select: { id: true, username: true },
    take: 20,
  });

  res.json({ users: users.filter((u) => u.id !== s.userId) });
});

