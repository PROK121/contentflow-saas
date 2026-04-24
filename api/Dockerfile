# syntax=docker/dockerfile:1.7

# =========================
# Stage 1: deps — полный набор зависимостей (для сборки)
# =========================
FROM node:20-bookworm-slim AS deps
WORKDIR /app

# OpenSSL нужен Prisma для генерации клиента под конкретную ОС/архитектуру.
RUN apt-get update && apt-get install -y --no-install-recommends \
      openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY prisma ./prisma
# postinstall: "prisma generate" — клиент соберётся сразу под контейнер.
RUN npm ci --no-audit --no-fund


# =========================
# Stage 2: builder — компилируем TypeScript в dist/
# =========================
FROM node:20-bookworm-slim AS builder
WORKDIR /app

ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Pre-generate Prisma client (safety net) и сборка Nest
RUN npx prisma generate \
 && npm run build


# =========================
# Stage 3: prod-deps — только продакшен-зависимости (меньше образ)
# =========================
FROM node:20-bookworm-slim AS prod-deps
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
      openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY prisma ./prisma
# --omit=dev убирает nest-cli, ts-node, eslint и т.д. postinstall сгенерит prisma client.
RUN npm ci --omit=dev --no-audit --no-fund


# =========================
# Stage 4: runner — минимальный runtime c LibreOffice
# =========================
FROM node:20-bookworm-slim AS runner
WORKDIR /app

# LibreOffice нужен для конвертации .docx → .pdf (commercial-offers/libreoffice-pdf.ts).
# Берём core+writer без рекомендаций, чтобы не тянуть java-help, galleries и т.д.
RUN apt-get update && apt-get install -y --no-install-recommends \
      libreoffice-core libreoffice-writer \
      fonts-dejavu fonts-liberation fonts-noto-core \
      openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=3000
ENV LIBREOFFICE_PATH=/usr/bin/soffice
# Render Disk смонтирован сюда (задаётся через render.yaml / dashboard).
ENV UPLOAD_DIR=/data

# Непривилегированный пользователь
RUN groupadd --system --gid 1001 nodejs \
 && useradd  --system --uid 1001 --gid nodejs nest \
 && mkdir -p /data \
 && chown -R nest:nodejs /data /app

# Копируем только то, что нужно в runtime
COPY --from=prod-deps --chown=nest:nodejs /app/node_modules ./node_modules
COPY --from=builder   --chown=nest:nodejs /app/dist ./dist
COPY --from=builder   --chown=nest:nodejs /app/prisma ./prisma
COPY --from=builder   --chown=nest:nodejs /app/fonts ./fonts
COPY --from=builder   --chown=nest:nodejs /app/templates ./templates
COPY --from=builder   --chown=nest:nodejs /app/package.json ./package.json

USER nest

EXPOSE 3000

# На старте: применяем миграции Prisma, потом поднимаем Nest.
# `prisma migrate deploy` идемпотентен — применит только новые миграции.
# nest build с текущим tsconfig кладёт main.js в dist/src/main.js.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/main"]
