import { Router } from "express";
import type { Request, Response } from "express";
import { z } from "zod";
import { authService, hashPassword, type Role } from "../auth/auth-service.js";
import { logAction, extractIp } from "../logging/logger.service.js";

export const authRouter = Router();

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

const verifySchema = z.object({
  challengeId: z.string().min(1),
  emailCode:   z.string().regex(/^\d{6}$/),
  smsCode:     z.string().regex(/^\d{6}$/),
});

const registerSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(6),
  email:    z.string().email(),
  phone:    z.string().trim().min(6),
});

const recoveryStartSchema = z.object({
  identifier: z.string().trim().min(1),
});

const recoveryCompleteSchema = verifySchema.extend({
  newPassword: z.string().min(6),
});

function getPrisma() {
  if (!process.env.DATABASE_URL) return null;
  return import("../prisma-client.js").then((m) => m.prismaClient);
}

function attachSession(req: Request, result: {
  user: { id: string; username: string; role: Role };
  token: string;
  expiresAt: number;
}) {
  req.session.userId = result.user.id;
  req.session.username = result.user.username;
  req.session.role = result.user.role;
  req.session.authToken = result.token;
  req.session.tokenExpiresAt = result.expiresAt;
  req.session.lastActivityAt = Date.now();
}

authRouter.get("/me", (req: Request, res: Response) => {
  const s = req.session;
  if (!s.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  res.json({
    id: s.userId,
    username: s.username,
    role: s.role,
    permissions: authService.permissionsFor(s.role as Role),
  });
});

authRouter.post("/login", async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  const ip = extractIp(req);

  if (!parsed.success) {
    res.status(400).json({ error: "Username and password are required." });
    return;
  }

  const prisma = await getPrisma();
  if (prisma) {
    const user = await prisma.user.findUnique({ where: { username: parsed.data.username.trim() } });
    if (user) {
      authService.upsertStoredUser({
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        passwordHash: user.password,
      });
    }
  }

  const challenge = authService.beginLogin(parsed.data.username, parsed.data.password);
  if (!challenge) {
    void logAction({
      username: parsed.data.username.trim(),
      action: "LOGIN_FAILED",
      details: { attemptedUsername: parsed.data.username.trim() },
      ipAddress: ip,
    });
    res.status(401).json({ error: "Invalid username or password." });
    return;
  }

  res.status(202).json(challenge);
});

authRouter.post("/login/verify", (req: Request, res: Response) => {
  const parsed = verifySchema.safeParse(req.body);
  const ip = extractIp(req);
  if (!parsed.success) {
    res.status(400).json({ error: "Email code and SMS code are required." });
    return;
  }

  try {
    const result = authService.completeLogin(
      parsed.data.challengeId,
      parsed.data.emailCode,
      parsed.data.smsCode,
    );
    if (!result) {
      res.status(401).json({ error: "Invalid verification challenge." });
      return;
    }

    attachSession(req, result);

    void logAction({
      userId: result.user.id,
      username: result.user.username,
      role: result.user.role,
      action: "LOGIN",
      ipAddress: ip,
    });

    res.json({
      id: result.user.id,
      username: result.user.username,
      role: result.user.role,
      permissions: authService.permissionsFor(result.user.role),
      token: result.token,
      expiresAt: result.expiresAt,
    });
  } catch (error) {
    res.status(401).json({ error: error instanceof Error ? error.message : "Verification failed." });
  }
});

authRouter.post("/register", async (req: Request, res: Response) => {
  const parsed = registerSchema.safeParse(req.body);
  const ip = extractIp(req);

  if (!parsed.success) {
    res.status(400).json({ error: "Username, valid email, phone, and a 6+ character password are required." });
    return;
  }

  try {
    const prisma = await getPrisma();
    const result = prisma
      ? await registerPrismaUser(prisma, parsed.data)
      : authService.register(parsed.data);
    attachSession(req, result);

    void logAction({
      userId: result.user.id,
      username: result.user.username,
      role: result.user.role,
      action: "REGISTER",
      details: { email: result.user.email, phone: result.user.phone },
      ipAddress: ip,
    });

    res.status(201).json({
      id: result.user.id,
      username: result.user.username,
      role: result.user.role,
      permissions: authService.permissionsFor(result.user.role),
      token: result.token,
      expiresAt: result.expiresAt,
    });
  } catch (error) {
    res.status(error instanceof Error && error.name === "ConflictError" ? 409 : 400).json({
      error: error instanceof Error ? error.message : "Registration failed.",
    });
  }
});

authRouter.post("/recovery/start", async (req: Request, res: Response) => {
  const parsed = recoveryStartSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Username or email is required." });
    return;
  }

  const prisma = await getPrisma();
  if (prisma) {
    const identifier = parsed.data.identifier.toLowerCase();
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { username: { equals: parsed.data.identifier, mode: "insensitive" } },
          { email: { equals: identifier, mode: "insensitive" } },
        ],
      },
    });
    if (user) {
      authService.upsertStoredUser({
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        passwordHash: user.password,
      });
    }
  }

  const challenge = authService.beginRecovery(parsed.data.identifier);
  if (!challenge) {
    res.status(404).json({ error: "Account not found." });
    return;
  }

  res.status(202).json(challenge);
});

authRouter.post("/recovery/complete", async (req: Request, res: Response) => {
  const parsed = recoveryCompleteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Challenge, codes, and a 6+ character password are required." });
    return;
  }

  try {
    const user = authService.completeRecovery(
      parsed.data.challengeId,
      parsed.data.emailCode,
      parsed.data.smsCode,
      parsed.data.newPassword,
    );
    if (!user) {
      res.status(401).json({ error: "Invalid verification challenge." });
      return;
    }

    const prisma = await getPrisma();
    if (prisma) {
      await prisma.user.update({
        where: { id: user.id },
        data: { password: hashPassword(parsed.data.newPassword) },
      });
    }

    res.json({ id: user.id, username: user.username, role: user.role });
  } catch (error) {
    res.status(401).json({ error: error instanceof Error ? error.message : "Password recovery failed." });
  }
});

async function registerPrismaUser(
  prisma: NonNullable<Awaited<ReturnType<typeof getPrisma>>>,
  input: z.infer<typeof registerSchema>,
) {
  const existing = await prisma.user.findUnique({ where: { username: input.username.trim() } });
  if (existing) {
    const error = new Error("Username already taken.");
    error.name = "ConflictError";
    throw error;
  }

  const user = await prisma.user.create({
    data: {
      username: input.username.trim(),
      email: input.email.trim(),
      password: hashPassword(input.password),
      role: "USER",
    },
  });

  authService.upsertStoredUser({
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    passwordHash: user.password,
  });

  const result = authService.createSessionForUser(user.id);
  if (!result) throw new Error("Registration failed.");
  return result;
}

authRouter.post("/logout", (req: Request, res: Response) => {
  const s = req.session;
  const ip = extractIp(req);

  if (s.userId) {
    void logAction({
      userId: s.userId,
      username: s.username,
      role: s.role as Role,
      action: "LOGOUT",
      ipAddress: ip,
    });
  }

  req.session.destroy(() => {
    res.clearCookie("sid");
    res.status(204).send();
  });
});
