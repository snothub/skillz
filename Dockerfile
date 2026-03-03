# ─── Stage 1: deps ────────────────────────────────────────────────────────────
FROM node:22-alpine AS deps

WORKDIR /app

# Copy manifests first for layer caching
COPY package.json package-lock.json ./

RUN npm ci

# ─── Stage 2: build ───────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

# ─── Stage 3: runtime ─────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime

WORKDIR /app

# Non-root user for least-privilege operation
RUN addgroup -S mcp && adduser -S mcp -G mcp

# Production dependencies only
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Compiled server
COPY --from=builder /app/dist ./dist

# Bake skills into the image under a well-known path.
# Override at deploy-time with SKILLS_DIR env var if you later
# switch to a mounted volume (ConfigMap / PVC).
COPY .claude/skills ./skills

# Drop to non-root
USER mcp

ENV NODE_ENV=production \
    SKILLS_DIR=/app/skills \
    PORT=3000

EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost:3000/health || exit 1

ENTRYPOINT ["node", "dist/skills-server.js"]