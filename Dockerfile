# syntax=docker/dockerfile:1

# ---- Base ---------------------------------------------------------------------
FROM node:24-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# ---- Dependencies (cached until package-lock.json changes) --------------------
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# ---- Tooling: source + dev dependencies, runs migrations and the admin seed ---
FROM base AS tooling
COPY --from=deps /app/node_modules ./node_modules
COPY . .
CMD ["sh", "-c", "npm run db:migrate && npm run db:seed"]

# ---- Build --------------------------------------------------------------------
FROM tooling AS builder
ENV NEXT_OUTPUT=standalone
RUN npm run build

# ---- Runtime: minimal image containing only the standalone server -------------
FROM base AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0

COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "server.js"]
