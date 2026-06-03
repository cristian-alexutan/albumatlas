import express from "express";
import cors from "cors";
import session from "express-session";
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@as-integrations/express5";
import { typeDefs } from "./graphql/schema.js";
import { resolvers } from "./graphql/resolvers.js";
import { albumsRouter } from "./rest/albums.routes.js";
import { tracksRouter } from "./rest/tracks.routes.js";
import { statisticsRouter } from "./rest/statistics.routes.js";
import { generatorRouter } from "./rest/generator.routes.js";
import { authRouter } from "./rest/auth.routes.js";
import { reviewsRouter } from "./rest/reviews.routes.js";
import { chatRouter } from "./rest/chat.routes.js";
import { usersRouter } from "./rest/users.routes.js";
import { logsRouter } from "./rest/logs.routes.js";
import { observationsRouter } from "./rest/observations.routes.js";

export async function createApp() {
  const app = express();
  app.set("trust proxy", 1); // Required when behind Railway/Vercel reverse proxy for secure cookies
  const sessionIdleMs = Number(process.env.SESSION_IDLE_MS ?? 15 * 60 * 1000);
  const cookieSecure = process.env.COOKIE_SECURE === "true" || process.env.HTTPS === "true";
  const sameSite = cookieSecure ? "none" : "lax";

  const rawOrigin = process.env.CORS_ORIGIN;

  app.use(
    cors({
      origin: rawOrigin
        ? rawOrigin.split(",").map((s) => s.trim())
        : (_origin, cb) => cb(null, true),
      credentials: true,
    }),
  );

  app.use(express.json());

  app.use(
    session({
      name: "sid",
      secret: process.env.SESSION_SECRET ?? "albumatlas-dev-secret",
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: {
        httpOnly: true,
        sameSite,
        secure: cookieSecure,
        maxAge: sessionIdleMs,
      },
    }),
  );

  app.use((req, res, next) => {
    if (!req.session.userId) {
      next();
      return;
    }

    const now = Date.now();
    if (req.session.lastActivityAt && now - req.session.lastActivityAt > sessionIdleMs) {
      req.session.destroy(() => {
        res.clearCookie("sid");
        res.status(401).json({ error: "Session expired due to inactivity." });
      });
      return;
    }

    req.session.lastActivityAt = now;
    next();
  });

  app.use("/api/auth", authRouter);
  app.use("/api/albums", albumsRouter);
  app.use("/api/albums/:albumId/tracks", tracksRouter);
  app.use("/api/albums/:albumId/reviews", reviewsRouter);
  app.use("/api/statistics", statisticsRouter);
  app.use("/api/generator", generatorRouter);
  app.use("/api/chat", chatRouter);
  app.use("/api/users", usersRouter);
  app.use("/api/logs", logsRouter);
  app.use("/api/observations", observationsRouter);

  const apollo = new ApolloServer({ typeDefs, resolvers });
  await apollo.start();
  app.use("/graphql", expressMiddleware(apollo, {
    context: async ({ req }) => ({ session: req.session }),
  }));

  app.get("/health", (_req, res) => res.json({ ok: true }));

  return app;
}
