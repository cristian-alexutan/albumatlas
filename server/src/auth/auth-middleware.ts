import type { NextFunction, Request, Response } from "express";
import { authService, type Permission, type Role } from "./auth-service.js";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) {
    res.status(401).json({ error: "Login required." });
    return;
  }
  next();
}

export function requireRole(role: Role) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.session?.userId) {
      res.status(401).json({ error: "Login required." });
      return;
    }
    if (req.session.role !== role) {
      res.status(403).json({ error: `${role} access required.` });
      return;
    }
    next();
  };
}

export function requirePermission(permission: Permission) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.session?.userId) {
      res.status(401).json({ error: "Login required." });
      return;
    }
    if (!authService.hasPermission(req.session.role as Role | undefined, permission)) {
      res.status(403).json({ error: "Permission denied." });
      return;
    }
    next();
  };
}
