-- Добавляем User.tokenVersion для отзыва выданных JWT.
-- Идемпотентная миграция — безопасна для повторного применения.
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "tokenVersion" INTEGER NOT NULL DEFAULT 0;
