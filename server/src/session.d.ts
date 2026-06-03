// Augment express-session's SessionData interface so session fields are typed
// throughout the codebase without casting.
import "express-session";

declare module "express-session" {
  interface SessionData {
    userId:         string;
    username:       string;
    role:           "ADMIN" | "USER";
    authToken:      string;
    tokenExpiresAt: number;
    lastActivityAt: number;
  }
}
