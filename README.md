# ContentFlow (RightsHub / MediaDeal)

**Позиционирование:** B2B SaaS для дистрибуции и лицензирования медиаконтента в СНГ: CRM сделок, каталог прав, контракты, роялти, прозрачность для правообладателей, интеграции с бухгалтерией и ЭДО.

**Слоган (рабочий):** «Сделки, права и деньги — в одном контуре».

## Структура репозитория


| Путь                               | Назначение                                              |
| ---------------------------------- | ------------------------------------------------------- |
| `docs/PRD.md`                      | Продуктовая спецификация, роли, модули, workflow        |
| `docs/DATA_MODEL.md`               | Сущности, статусы, связи, юридические атрибуты          |
| `docs/CIS_COMPLIANCE.md`           | Налоги у источника, валюты, сертификаты резидентства    |
| `docs/TECH_ARCHITECTURE.md`        | Техническая архитектура, стек, безопасность, интеграции |
| `openapi/contentflow-core.yaml`    | Черновик REST API ядра                                  |
| `packages/core-domain/entities.ts` | Типы доменной модели (TypeScript)                       |
| `api/`                             | Backend **NestJS + Prisma + PostgreSQL**                |
| `web/`                             | Веб-панель **Next.js 15** (порт **3020**)               |
| `docker-compose.yml`               | Локальный Postgres для разработки                       |


## Backend (NestJS)

### Вариант A: Postgres в Docker

Нужен установленный [Docker Desktop](https://www.docker.com/products/docker-desktop/) (команда `docker` в терминале).

```bash
docker compose up -d
cd api
cp .env.example .env
npm install
npx prisma migrate deploy
npm run db:seed
npm run start:dev
```

### Вариант B: Postgres без Docker (macOS + Homebrew)

Если `docker: command not found`, поставь Postgres локально:

```bash
brew install postgresql@16
brew services start postgresql@16
```

Добавь в `PATH` бинарники (Apple Silicon чаще `/opt/homebrew`, Intel — `/usr/local`):

```bash
echo 'export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

Создай БД (имя пользователя в URL — как у твоего Mac-пользователя, см. `whoami`):

```bash
createdb contentflow
```

В `**api/.env**` укажи (подставь своего пользователя вместо `admin`, если `whoami` другое):

```env
DATABASE_URL="postgresql://admin@localhost:5432/contentflow?schema=public"
```

Дальше:

```bash
cd api
npm install
npx prisma migrate deploy
npm run db:seed
npm run start:dev
```

Базовый префикс API: `http://localhost:3000/v1` (например `GET /v1/health`, `GET /v1/deals`).

В `api/.env` можно задать `WEB_ORIGIN=http://localhost:3020` (по умолчанию в коде), чтобы CORS совпадал с URL веб-панели.

## Веб-интерфейс (Next.js)

В отдельном терминале, пока API запущен:

```bash
cd web
cp .env.example .env.local
npm install
npm run dev
```

Открой в браузере: `http://localhost:3020` — **Обзор** (`/`). Это UI, не JSON API.

Запросы `http://localhost:3020/v1/...` **проксируются** на Nest (`API_URL`, по умолчанию порт 3000), чтобы в одном origin можно было смотреть API из браузера. Панель: `/`, `/content`, `/deals`, `/contracts`, `/payments`, `/tasks`, `/portal`, форма создания сделки — `/deals/new`.

Если порт занят, временно: `npx next dev --turbopack -p 3030` и выставь в API `WEB_ORIGIN=http://localhost:3030`.

### Ошибка «Internal Server Error» в панели

1. В `**web/.env.local`** должно быть `**API_URL=http://127.0.0.1:3000**` (Nest), не порт **3020** (Next).
2. Проверка API вручную: `curl -s http://127.0.0.1:3000/v1/debug/ping` и `curl -s http://127.0.0.1:3000/v1/debug/db` (второй покажет, доступна ли БД).
3. Перезапусти процесс `**npm run start:dev`** в папке `api` после обновления кода.

## Название в линейке

- **ContentFlow** — основной бренд платформы.
- **RightsHub** — модуль каталога прав и метаданных лицензий.
- **MediaDeal** — модуль CRM, сделок и коммерческих условий.

## Быстрый старт для разработки

Документация и OpenAPI не требуют сборки. Для просмотра контракта API:

```bash
npx @redocly/cli preview-docs openapi/contentflow-core.yaml
```

(При отсутствии Node — откройте YAML в любом OpenAPI-редакторе.)