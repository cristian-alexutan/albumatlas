# ── Build stage ──────────────────────────────────────────────────────────────
# Build context is the project ROOT (set in docker-compose.yml) so we can
# reach both server/ and data/.
FROM node:20-alpine AS builder

WORKDIR /build/server

# Install dependencies first (layer-cached)
COPY server/package*.json ./
COPY server/prisma ./prisma/
RUN npm ci

# Compile TypeScript (prisma generate already ran via postinstall above)
COPY server/ ./
RUN npm run build

# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime

WORKDIR /app/server

ENV NODE_ENV=production

# Copy schema first so postinstall (prisma generate) can find it
COPY server/package*.json ./
COPY server/prisma ./prisma/
RUN npm ci --omit=dev

# Compiled output
COPY --from=builder /build/server/dist ./dist

# Seed data (../../data/albums.json relative to dist/ = /app/data/albums.json)
WORKDIR /app
COPY data/ ./data/

WORKDIR /app/server

EXPOSE 4000

# Apply pending migrations then start the server
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
