# syntax=docker/dockerfile:1.7

# =========================
# Stage 1: deps — чистая установка зависимостей
# =========================
FROM node:20-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json .npmrc* ./
RUN npm ci --no-audit --no-fund


# =========================
# Stage 2: builder — сборка Next.js (standalone output)
# =========================
FROM node:20-bookworm-slim AS builder
WORKDIR /app

# На проде API_URL, NEXT_PUBLIC_* и др. прокидываются как build-args,
# если им нужно «запечься» в бандл во время билда. Сейчас API_URL читается
# в runtime, поэтому build-args тут не нужны.
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build


# =========================
# Stage 3: runner — минимальный runtime-образ
# =========================
FROM node:20-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3020
ENV HOSTNAME=0.0.0.0

# Непривилегированный пользователь
RUN groupadd --system --gid 1001 nodejs \
 && useradd  --system --uid 1001 --gid nodejs nextjs

# Standalone output Next.js: серверный бандл + публичные ассеты + статика
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3020

# standalone создаёт /app/server.js — точка входа
CMD ["node", "server.js"]
