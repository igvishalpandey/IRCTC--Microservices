# syntax=docker/dockerfile:1

# ─── Build: install all deps, generate Prisma client, compile TS ──────────────
FROM node:24-alpine AS build
WORKDIR /app
RUN apk add --no-cache openssl
COPY package.json package-lock.json ./
RUN npm ci
COPY prisma ./prisma
RUN npx prisma generate
COPY . .
RUN npm run build

# ─── Migrate: one-off job image (run before rolling out new app pods) ──────────
FROM build AS migrate
CMD ["npx", "prisma", "migrate", "deploy"]

# ─── Runtime: production deps only, non-root ──────────────────────────────────
FROM node:24-alpine AS runtime
WORKDIR /app
RUN apk add --no-cache openssl tini
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/dist ./dist
COPY prisma ./prisma
USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD wget -qO- http://127.0.0.1:${PORT:-3001}/health/live || exit 1
# tini reaps zombies and forwards SIGTERM so graceful shutdown runs.
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "--enable-source-maps", "dist/index.js"]
