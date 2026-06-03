import { Router } from "express";
import type { Request, Response } from "express";
import { z } from "zod";
import { authService, hashPassword, type Role } from "../auth/auth-service.js";
import { logAction, extractIp } from "../logging/logger.service.js";
import { sendVerificationEmail } from "../email/mailer.js";
import qrcode from "qrcode";
import * as OTPAuth from "otpauth";

export const authRouter = Router();

// ── Validation schemas ────────────────────────────────────────────────────────

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

const verifySchema = z.object({
  challengeId: z.string().min(1),
  emailCode:   z.string().regex(/^\d{6}$/),
  totpCode:    z.string().min(6).max(8),  // TOTP tokens are 6 digits
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function getPrisma() {
  if (!process.env.DATABASE_URL) return null;
  return import("../prisma-client.js").then((m) => m.prismaClient);
}

function attachSession(req: Request, result: {
  user: { id: string; username: string; role: Role };
  token: string;
  expiresAt: number;
}) {
  req.session.userId          = result.user.id;
  req.session.username        = result.user.username;
  req.session.role            = result.user.role;
  req.session.authToken       = result.token;
  req.session.tokenExpiresAt  = result.expiresAt;
  req.session.lastActivityAt  = Date.now();
}

// ── Routes ────────────────────────────────────────────────────────────────────

authRouter.get("/me", (req: Request, res: Response) => {
  const s = req.session;
  if (!s.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  res.json({
    id:          s.userId,
    username:    s.username,
    role:        s.role,
    permissions: authService.permissionsFor(s.role as Role),
  });
});

authRouter.post("/login", async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  const ip     = extractIp(req);

  if (!parsed.success) {
    res.status(400).json({ error: "Username and password are required." });
    return;
  }

  // Sync from DB if available
  const prisma = await getPrisma();
  if (prisma) {
    const user = await prisma.user.findUnique({ where: { username: parsed.data.username.trim() } });
    if (user) {
      authService.upsertStoredUser({
        id:           user.id,
        username:     user.username,
        email:        user.email,
        role:         user.role,
        passwordHash: user.password,
        totpSecret:   user.totpSecret,
      });
    }
  }

  const result = authService.beginLogin(parsed.data.username, parsed.data.password);
  if (!result) {
    void logAction({
      username:   parsed.data.username.trim(),
      action:     "LOGIN_FAILED",
      details:    { attemptedUsername: parsed.data.username.trim() },
      ipAddress:  ip,
    });
    res.status(401).json({ error: "Invalid username or password." });
    return;
  }

  // Send email with OTP code (non-blocking — auth still works even if email fails)
  if (result.userEmail) {
    void sendVerificationEmail(result.userEmail, result.emailCode, "login");
  }

  res.status(202).json(result.challenge);
});

authRouter.post("/login/verify", (req: Request, res: Response) => {
  const parsed = verifySchema.safeParse(req.body);
  const ip     = extractIp(req);
  if (!parsed.success) {
    res.status(400).json({ error: "Email code and authenticator code are required." });
    return;
  }

  try {
    const result = authService.completeLogin(
      parsed.data.challengeId,
      parsed.data.emailCode,
      parsed.data.totpCode,
    );
    if (!result) {
      res.status(401).json({ error: "Invalid verification challenge." });
      return;
    }

    attachSession(req, result);

    void logAction({
      userId:    result.user.id,
      username:  result.user.username,
      role:      result.user.role,
      action:    "LOGIN",
      ipAddress: ip,
    });

    res.json({
      id:          result.user.id,
      username:    result.user.username,
      role:        result.user.role,
      permissions: authService.permissionsFor(result.user.role),
      token:       result.token,
      expiresAt:   result.expiresAt,
    });
  } catch (error) {
    res.status(401).json({ error: error instanceof Error ? error.message : "Verification failed." });
  }
});

authRouter.post("/register", async (req: Request, res: Response) => {
  const parsed = registerSchema.safeParse(req.body);
  const ip     = extractIp(req);

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
      userId:    result.user.id,
      username:  result.user.username,
      role:      result.user.role,
      action:    "REGISTER",
      details:   { email: result.user.email, phone: result.user.phone },
      ipAddress: ip,
    });

    // Build TOTP QR code for the newly registered user
    const totpSecret = result.totpSecret;
    const totpUri    = new OTPAuth.TOTP({
      issuer: "AlbumAtlas",
      label:  result.user.username,
      secret: OTPAuth.Secret.fromBase32(totpSecret),
    }).toString();
    const totpQr = await qrcode.toDataURL(totpUri);

    res.status(201).json({
      id:          result.user.id,
      username:    result.user.username,
      role:        result.user.role,
      permissions: authService.permissionsFor(result.user.role),
      token:       result.token,
      expiresAt:   result.expiresAt,
      totpSecret,
      totpQr,       // base64 PNG data URL – display as <img src={totpQr} />
    });
  } catch (error) {
    res.status(
      error instanceof Error && error.name === "ConflictError" ? 409 : 400,
    ).json({ error: error instanceof Error ? error.message : "Registration failed." });
  }
});

// GET /api/auth/totp/setup  – returns QR code for the current session user
authRouter.get("/totp/setup", async (req: Request, res: Response) => {
  const userId = req.session?.userId;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated." });
    return;
  }

  const info = authService.getTotpInfo(userId);
  if (!info) {
    res.status(404).json({ error: "User not found." });
    return;
  }

  const qrDataUrl = await qrcode.toDataURL(info.uri);
  res.json({ secret: info.secret, uri: info.uri, qrDataUrl });
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
          { email:    { equals: identifier,              mode: "insensitive" } },
        ],
      },
    });
    if (user) {
      authService.upsertStoredUser({
        id:           user.id,
        username:     user.username,
        email:        user.email,
        role:         user.role,
        passwordHash: user.password,
        totpSecret:   user.totpSecret,
      });
    }
  }

  const result = authService.beginRecovery(parsed.data.identifier);
  if (!result) {
    res.status(404).json({ error: "Account not found." });
    return;
  }

  // Send recovery email (non-blocking — auth still works even if email fails)
  if (result.userEmail) {
    void sendVerificationEmail(result.userEmail, result.emailCode, "recovery");
  }

  res.status(202).json(result.challenge);
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
      parsed.data.totpCode,
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
        data:  { password: hashPassword(parsed.data.newPassword) },
      });
    }

    res.json({ id: user.id, username: user.username, role: user.role });
  } catch (error) {
    res.status(401).json({
      error: error instanceof Error ? error.message : "Password recovery failed.",
    });
  }
});

authRouter.post("/logout", (req: Request, res: Response) => {
  const s  = req.session;
  const ip = extractIp(req);

  if (s.userId) {
    void logAction({
      userId:    s.userId,
      username:  s.username,
      role:      s.role as Role,
      action:    "LOGOUT",
      ipAddress: ip,
    });
  }

  req.session.destroy(() => {
    res.clearCookie("sid");
    res.status(204).send();
  });
});

// ── Prisma register helper ────────────────────────────────────────────────────

async function registerPrismaUser(
  prisma: NonNullable<Awaited<ReturnType<typeof getPrisma>>>,
  input: z.infer<typeof registerSchema>,
) {
  const existing = await prisma.user.findUnique({ where: { username: input.username.trim() } });
  if (existing) {
    const error = new Error("Username already taken.");
    error.name  = "ConflictError";
    throw error;
  }

  // Generate TOTP secret before saving
  const totpSecret = new OTPAuth.Secret().base32;

  const user = await prisma.user.create({
    data: {
      username:   input.username.trim(),
      email:      input.email.trim(),
      password:   hashPassword(input.password),
      role:       "USER",
      totpSecret,
    },
  });

  authService.upsertStoredUser({
    id:           user.id,
    username:     user.username,
    email:        user.email,
    role:         user.role,
    passwordHash: user.password,
    totpSecret:   user.totpSecret ?? totpSecret,
  });

  const result = authService.createSessionForUser(user.id);
  if (!result) throw new Error("Registration failed.");
  return { ...result, totpSecret: user.totpSecret ?? totpSecret };
}
