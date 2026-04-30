# ContentFlow — аудит и предложения по улучшениям

Дата: 30 апреля 2026
Скоуп: репозиторий `contentflow-saas/` целиком (api/, web/, prisma, docs, openapi, render.yaml).
Контекст: B2B SaaS для дистрибуции/лицензирования медиаконтента в СНГ.
Стек: NestJS 10 + Prisma 5.22 (Postgres), Next.js 15 + React 19, Render (Docker, frankfurt).

---

## TL;DR

Проект функционально проработан: продумана модель прав/ролей/налогов, реализован кабинет правообладателя со scope-сервисом и аудит-логом, есть click-sign контрактов, инвайт/magic-link, шаблонные письма. Архитектурно это «модульный монолит», что для текущего масштаба адекватно.

Однако есть **критические дыры**, прежде всего по безопасности и финансовой целостности, которые нужно закрыть до выхода в прод. Список ниже сгруппирован по приоритетам:

- **P0** — закрыть до релиза (security/data integrity).
- **P1** — закрыть в ближайший спринт-два (надёжность, deploy, compliance).
- **P2** — улучшения, повышающие качество и расширяемость.

---

## P0. Критическое — закрыть до релиза

### 1. RBAC дыра: бóльшая часть API не проверяет роль

В `app.module.ts` глобально подключён только `JwtAuthGuard`. Проверка роли `manager`/`admin` (`assertManagerOrAdmin`) присутствует ТОЛЬКО в:

- `organizations.controller.ts`
- `material-requests.controller.ts` (CRM-сторона)
- `users.controller.ts`

`assertAdminDeleteUser` стоит только на `DELETE`-эндпоинтах в contracts/tasks/commercial-offers/deals.

Контроллеры **БЕЗ ролевой проверки** на чтение/запись:

- `/v1/finance/*` — `paymentStats`, `listPayments`, `listPayouts`, `updatePayment`. Любой пользователь с валидным JWT (включая `rights_owner` или `client`) может вытащить **полный список платежей и выплат всех контрагентов**.
- `/v1/contracts/*` — список контрактов, скачивание версий, патч, создание.
- `/v1/deals/*` — список сделок, создание, документы, активити.
- `/v1/catalog/*`, `/v1/catalog/items/*` — каталог, экспорт.
- `/v1/tasks/*`, `/v1/commercial-offers/*` — задачи и офферы по всем компаниям.

Middleware Next.js на фронте редиректит `rights_owner` на `/holder/*`, но это UX-защита, а не security: вызвать `https://api.../v1/finance/payouts` напрямую через `curl -H "Cookie: cf_session=..."` он сможет (CORS не мешает, потому что это не браузер).

**Что делать:**

- Добавить глобальный `RolesGuard` поверх `JwtAuthGuard`. Вариант A: декоратор `@Roles('admin', 'manager')` + reflector. Вариант B (быстрее) — на каждом небезопасном контроллере поставить `@UseGuards(ManagerOrAdminGuard)` или вызывать `assertManagerOrAdmin(req)` во всех `@Get`/`@Post`/`@Patch`. Не забыть: deals, contracts, finance, catalog, commercial-offers, tasks, hetzner-storage (там есть `assertAdmin`, ок).
- Сделать «default deny» на уровне модуля: новый контроллер без явной роли должен ломаться при тесте.
- Добавить e2e-тест «`rights_owner` JWT → 403 на `/v1/finance/payouts`», чтобы регрессий больше не было.

---

### 2. JWT нельзя отозвать; долгий TTL без refresh

`auth.module.ts`: `signOptions: { expiresIn: '7d' }`. Refresh-токенов нет, blacklist нет, `User.lastLogoutAt` нет. Если токен утёк (украденная cookie, скомпрометированный почтовый ящик с magic-link) — он действителен 7 дней, и сменить ничего нельзя кроме как ротировать `JWT_SECRET` на всём сервисе (что разлогинит всех).

**Что делать:**

- Ввести `User.tokenVersion: Int @default(0)` в Prisma. JWT-payload пополнить полем `tv`. В `JwtStrategy.validate` сравнивать `payload.tv === user.tokenVersion`. На «разлогинить с этого устройства / отовсюду» инкрементировать `tokenVersion`.
- Сократить TTL access-токена до 30–60 минут, ввести refresh-токен (httpOnly cookie, 30 дней), ротировать его при каждом обновлении.
- Логаут (`/api/auth/logout`): инкрементировать `tokenVersion` пользователя (опционально только для текущей сессии — тогда модель «refresh sessions» в БД).
- Аудит: писать `login_password`/`logout` в `HolderAuditLog` для rights_owner (сейчас пишется только для magic-link).

---

### 3. Финансовые суммы: точность и сериализация

В `Contract.amount`/`Decimal(18,2)` всё хорошо, но:

- В `contracts.service.ts` агрегирующая сумма для платформенного контракта считается через `Number.parseFloat` и сложение Number-ов. На больших значениях/копейках это даёт ошибки округления. Деньги должны проходить через `Decimal` от `@prisma/client/runtime/library`.
- `Deal.commercialSnapshot.expectedValue` хранится как строка/число свободного формата — `"100 000,50"` парсится регулярками. Это путь к ошибкам. Нужно перевести в нормализованный JSON-объект `{ amount: string, currency: string }` и валидировать на входе.
- В нескольких местах суммы возвращаются клиенту как `string` — корректно (JS Number теряет precision на 2^53), но не везде последовательно (где-то `.toString()`, где-то нет — нужна проверка, что в JSON наружу никогда не уходит `bigint`/`Decimal` сырьём).

**Что делать:**

- Завести внутренний модуль `money` с типом `Money = { amount: string; currency: ISO4217 }`, утилитами `add/sub/mul/divDecimal`, и принудительно прогонять все деньги через него.
- Поднять линт-правило: «никаких `parseFloat`/`Number()` рядом с переменными `amount/price/value`».
- Добавить unit-тесты на `paymentPreview`, агрегацию контрактов по нескольким сделкам, налоговый расчёт.

---

### 4. Налоговый движок описан, но не реализован

`docs/CIS_COMPLIANCE.md` проектирует таблицу ставок, выбор `treaty_rate_if_applicable`, обязательную валидацию срока сертификата резидентства, override юристом с записью в аудит. В коде же:

- В `Payout` поля `withholdingTaxAmount`/`amountNet` есть, но логики, **где** и **из чего** они высчитываются, нет — всё, по сути, заполняется руками или нулями.
- `TaxProfile.withholdingRateOverride` существует, но никем не используется на запись Payout.
- Нет таблицы справочника ставок «страна-страна-тип дохода».
- Нет напоминаний за 30 дней до истечения `validUntil`.

Это юридический риск: при налоговой проверке нечем доказать, по какому правилу применили ставку.

**Что делать:**

- Завести модуль `TaxEngine` с pure-функцией `computeWithholding(input): { rate, amountWithheld, ruleId, treatyApplied }` + табличный справочник правил (Prisma-модель `TaxRule`).
- Снимок применённого правила писать в `Payout.taxProfileSnapshotId` (уже есть поле — заполнить).
- Cron-задача (BullMQ или встроенный `@nestjs/schedule`) на проверку `TaxProfile.validUntil`: за 30 дней до истечения — Task менеджеру.
- Аудит для override: если юрист задал ручную ставку — обязательно `comment` + запись в `HolderAuditLog` (или в новый `FinanceAuditLog` для CRM-стороны; сейчас аудит есть только для holder-кабинета).

---

### 5. PDF-плейсхолдер выдаётся как «настоящий» документ

`ContractsService.getVersionFileForDownload` при отсутствии файла на диске **генерирует фейковый PDF** (`writeContractPlaceholderPdf`) и отдаёт его клиенту, предположительно для dev/MVP. На проде это опасно: если файл потерялся (например, потерялся mount у Render), пользователь получит юридически бессмысленный PDF, не отличая его от реального. И `sha256`, записанный при первом создании в `ContractVersion.sha256`, при этом не совпадёт с фейком, но никто это не проверяет в момент скачивания.

**Что делать:**

- В проде кидать `ServiceUnavailableException` («документ временно недоступен, обратитесь к менеджеру»), плейсхолдер использовать только при `NODE_ENV !== 'production'`.
- При скачивании пересчитывать `sha256(file)` и сверять с `ContractVersion.sha256`. Если не совпадает — отказ + критичный алерт + audit-запись (`download_contract_hash_mismatch`).
- Заменить локальный disk на Hetzner SFTP / S3 для версий контрактов: сейчас они на Render persistent disk 1 ГБ, которого едва хватит. См. п. 6.

---

### 6. Файловое хранилище: 1 ГБ на Render и 100 ГБ лимит загрузки

`render.yaml` подключает `disk.sizeGB: 1` под `/data`. При этом:

- `MATERIAL_UPLOAD_LIMIT = 100 * 1024 * 1024 * 1024` (100 ГБ) на одну загрузку правообладателя.
- Несколько мастер-копий быстро переполняют диск; даже 1 видео в 4К не помещается.
- `HetznerStorageService` написан, но **в потоках загрузки материалов и контрактов не используется**: материалы пишутся в локальный `materialsUploadRoot()`, скачивание идёт оттуда же.
- На Render persistent disk не реплицируется и не имеет point-in-time recovery — потеря инстанса = потеря uploads.

**Что делать:**

- Сделать загрузку «двухступенчатой»: multer пишет на локальный диск во временную директорию → асинхронный воркер заливает на Hetzner SFTP / S3 → запись в БД (storageKey) + удаление локальной копии. Или сразу стримить в Hetzner через `multer-storage-engine`.
- Скачивание: `StreamableFile` из стрима Hetzner SFTP (метод `downloadStream` уже есть). Локальный диск использовать только как кэш на текущий запрос.
- Лимит загрузки на правообладателя: 100 ГБ — нонсенс для синхронной HTTP-передачи (таймауты, OOM в multer). Рекомендация: для крупных мастеров использовать **pre-signed upload URL** в S3 / Hetzner Object Storage (а не SFTP, у Hetzner есть и тот и другой). HTTP-эндпоинт оставить для файлов до 2 ГБ.
- Pre-signed download URL для отдачи готовых PDF/мастеров через CDN, чтобы инстанс API не упирался в i/o.

---

### 7. Утечка деталей через ответы об ошибках

`GlobalExceptionFilter` в случае не-`HttpException` отдаёт клиенту:

```json
{ "statusCode": 500, "message": "<exception.message>", "path": "/v1/...", "error": "Internal Server Error" }
```

`exception.message` для Prisma включает имена таблиц, колонок, иногда SQL и значения. Для пользователя это утечка структуры схемы и потенциально ПДн.

**Что делать:**

- В проде маскировать сообщение: «Внутренняя ошибка сервера, traceId=…». Полный stack/message класть в логи + Sentry.
- Завести `traceId` на уровне middleware (`crypto.randomUUID`), писать в logger и возвращать в ответе для саппорта.
- Подключить Sentry / Logflare / Better Stack для алертов (сейчас вижу только `console.error`).

---

### 8. SSRF/redirect-open в magic-link и acceptUrl

`buildWebUrl(path)` берёт `WEB_ORIGIN` из env и склеивает. В `holder-auth.controller.ts` параметр `redirect` (`/holder/...`) валидируется простым `startsWith('/holder')` и `!startsWith('//')`. Но этого недостаточно:

- `dto.redirect = '/holder/.../@evil.com/path'` — не страшно (всё ещё свой origin), но в логах путаница.
- Если `WEB_ORIGIN` сконфигурирован с CSV из нескольких доменов (`split(',')` в `main.ts`) — а `buildWebUrl` берёт ровно `WEB_ORIGIN` целиком, то получится `"http://a.com,http://b.com/holder/..."`. Email-ссылка испорчена.
- Никакой ротации ключей подписи и checked-list redirect URI как в OAuth — но для magic-link это и не критично.

**Что делать:**

- В `EmailService.buildWebUrl` парсить первый origin из CSV, логировать предупреждение.
- В `requestMagicLink` валидировать `redirect` через парсинг URL и проверку `pathname.startsWith('/holder/')` без query/hash инъекций.
- В `magicUrl` использовать `URLSearchParams` вместо ручной сборки.

---

## P1. Важное — следующий спринт

### 9. Multi-tenant изоляция отсутствует на уровне CRM-сделок

Сейчас в схеме одна «наша компания» (internal Organization), а все Deal/Contract/Catalog глобальные. Если завтра придёт второй дистрибьютор — придётся вшивать `tenantId` во все таблицы и переписывать запросы.

**Что делать:**

- На старте — задокументировать как «single-tenant», в `README` явно. Если планируется SaaS на нескольких клиентов — заранее ввести `tenantId` (хотя бы nullable) и `Prisma middleware` для авто-фильтра, либо `Row-Level Security` в Postgres.

### 10. Отказ от TypeScript/ESLint при сборке web

`web/next.config.ts`:

```ts
typescript: { ignoreBuildErrors: true },
eslint: { ignoreDuringBuilds: true },
```

Это значит, что на проде может крутиться код с ошибками типизации/линтера. Комментарий честно говорит «временный escape-hatch», но он остался.

**Что делать:**

- В CI запускать `tsc --noEmit` и `eslint --max-warnings=0` отдельно от Next-билда; это сразу даст список долгов. Затем поэтапно вычистить `src/figma/pages/*` и убрать оба флага.
- Поднять `strict: true` в обоих tsconfig.

### 11. Нет автотестов поверх критичной бизнес-логики

`api/test/` — только `app.e2e-spec.ts` и `deals.e2e-spec.ts`. На сервисах никаких unit-тестов. Никаких тестов на:

- `rights-validation.ts` (territoryCoveredByLicenseTerm, isBlockingRightsConflict),
- click-sign контракта (статусы, идемпотентность, валидация consent),
- Holder scope (что чужая организация ничего не видит),
- Tax-расчёт (когда появится),
- email-шаблоны (рендер не должен падать с пустыми данными).

**Что делать:**

- Договориться: PR без тестов на новую бизнес-логику не мерджится.
- Минимум: jest unit-тесты на `holder-scope.service`, `rights-validation`, `contracts.service.signByHolder`, `email-templates`. На каждый — happy + 2 негативных.
- Использовать `@nestjs/testing` + `prisma-mock` или встраиваемый Postgres (testcontainers) — последнее предпочтительно, чтобы реально тестировать запросы.

### 12. Audit-log для CRM-стороны отсутствует

`HolderAuditLog` пишет только действия правообладателя. Действия менеджера (создание контракта, патч сделки, выпуск оффера, выплата правообладателю, изменение `holderFinanceVisibility`, удаление чего-либо) **никуда не пишутся**. На юр-разборах нечем подтвердить «кто и когда».

**Что делать:**

- Завести `CrmAuditLog` (или общий `AuditLog` с дискриминатором), писать ключевые события через интерсептор/декоратор `@Audit('contract.create')`.
- В админке `/counterparties` уже есть «История действий» — нужна симметричная вкладка для самой компании и фильтры по сущности.

### 13. Email: транзакционный канал, нет dead-letter

`EmailService.send` — fire-and-forget с `try/catch`, ошибки **только в логах**. Нет retry, нет dead-letter, нет таблицы `EmailQueue`. SMTP может «съесть» письмо магической ссылки (квота Gmail Relay, 5xx) — пользователь не сможет войти и не узнает, почему.

**Что делать:**

- Поставить `@nestjs/bull` (BullMQ + Redis) — очередь `email`, retry с экспоненциальным backoff, dead-letter в БД.
- Таблица `EmailDelivery (id, to, category, entityId, status, attempts, lastError, sentAt)`.
- В UI менеджера показывать статус доставки инвайтов («доставлено / отскочило / в очереди»). Сейчас возвращается `email.delivered` булево, но без истории.
- Подписать письма через DKIM/SPF/DMARC у домена `growixcontent.com` (если ещё нет — Render не делает это сам). Без DMARC magic-link будут уезжать в спам.

### 14. SMTP/secrets в `render.yaml` и `.env`

- `api/.env` лежит в репозитории и попал в zip. Внутри есть placeholder `JWT_SECRET=local-dev-secret-...`. Если когда-то туда положили рабочий секрет — он в истории git.
- `web/.env.example` содержит тот же placeholder. Хорошо, что для прода `Render` создаёт через `generateValue: true`.
- `HETZNER_STORAGE_USER/PASSWORD` имеет fallback на хардкод `'u585689'` и `''` в коде. Это значит, что в логах и трейсах при ошибке могут оказаться реальные значения, если неаккуратно их подмешать.

**Что делать:**

- Удалить `api/.env` из репо и git history (`git filter-repo`), добавить в `.gitignore` (вижу, что `.env.local` в gitignore у web — а у api ?). Перевыпустить **все** секреты, которые когда-либо туда клали.
- `assertEnv()` в `main.ts` уже хорош — расширить и сделать обязательными `JWT_SECRET` (минимум 48 символов в проде), `WEB_ORIGIN`, `EMAIL_FROM` (если SMTP_URL задан).
- Перенести SMTP/Hetzner-секреты в Render Secret Files или пулом через 1Password/Doppler.
- Минимум 32 байта энтропии в `JWT_SECRET` (`openssl rand -hex 48`).

### 15. Throttler: глобальный лимит 1200 rpm на IP

`ThrottlerModule` стоит общий 1200/мин. Это много (20 rps на одного клиента). При желании DDoS пройдёт через одного клиента, особенно учитывая `app.set('trust proxy', 1)` — `req.ip` берётся из `X-Forwarded-For`. На Render это разумно (proxy один), но для других провайдеров может быть проблемой (указали бы любой IP в заголовке).

**Что делать:**

- Снизить дефолтный throttle до 600 rpm. Health/debug `@SkipThrottle`.
- Для тяжёлых эндпоинтов (генерация PDF контракта, экспорт каталога, скачивание мастеров) — отдельный лимит 5–10 rpm.
- Пробросить лимиты ещё и по `userId` (а не только IP): корпоративный NAT даёт всем сотрудникам один IP.

### 16. Безопасность multipart-загрузок

В `material-storage.ts` имя файла на диске генерируется через `randomUUID()` — хорошо. Но:

- `path.extname(file.originalname).slice(0, 20).toLowerCase()` — оставляет произвольное расширение. На Linux `.exe`/`.html`/`.svg` не страшны, но если когда-то будете отдавать материалы через тот же origin — XSS через `.svg` (с `<script>`) вполне возможен.
- MIME проверяется по «префиксу слота», но не по реальному магическому числу файла. Загрузить `.exe` под именем `master.mp4` сейчас можно (multer не верифицирует контент).
- Multer пишет на диск ДО валидации MIME в сервисе, потом удаляет. При параллельных загрузках возможен временный пик disk usage.

**Что делать:**

- Whitelist расширений на каждый слот.
- Проверять реальный MIME через `file-type` (читает первые байты) после загрузки и до коммита в БД.
- Скачивание материалов и контрактов — отдельный субдомен (`files.growixcontent.com`) или `Content-Disposition: attachment` обязательный (уже есть для контрактов, но проверить везде).
- Опционально: ClamAV-сканер в очереди для входящих материалов.

### 17. Webhooks для подписания и интеграций отсутствуют

В `docs/PRD.md` упомянуто:

- E-signature: `SignatureProvider` + единый webhook endpoint.
- 1С: исходящие события `DealWon`, `ContractSigned`, `PaymentReceived`, `PayoutApproved`.
- WhatsApp: уведомления по политике.

В коде ничего из этого нет. `holderSign` — это «click-sign», простая ЭП по 63-ФЗ, без КЭП.

**Что делать:**

- Контракт outbox-events: новая таблица `DomainEvent (id, type, payload, deliveredAt, attempts)`. На каждом значимом действии пишем событие в той же транзакции, отдельный воркер доставляет подписчикам (1С/Slack/CRM-зеркало).
- Адаптер `SignatureProvider` (`Sign.Me` для физлиц-РФ, `КриптоПро/КонтурСайн` для юриков, DocuSign для не-СНГ). Делать webhook `POST /v1/integrations/signature/:provider` с проверкой подписи провайдера.
- WhatsApp Business API — либо BSP типа Twilio/360dialog, либо прямой Cloud API. Минимум — opt-in, локализация шаблонов.

### 18. FX-курсы — поле есть, источника нет

`Contract.fxRateFixed`/`fxRateSource`/`fxLockedAt` существуют, но никакого `FxRateProvider` в коде нет. На практике курс фиксируется руками — это легко даёт расхождение с бухгалтерией.

**Что делать:**

- Сервис `FxService` с двумя адаптерами (ЦБ РФ + НБ РК + ECB), кешем на 24 ч, fallback при недоступности.
- При переходе сделки в `contract` — авто-фиксация курса дня. UI должен показать «зафиксирован курс ЦБ РФ на DD.MM.YYYY = X».
- История курсов в `FxRateSnapshot (currencyPair, source, rate, fetchedAt)`.

### 19. CIS-комплаенс: ПДн и место хранения

`docs/PRD.md` 5: «Хранение ПДн в РФ/регионе по требованию заказчика». На Render во Frankfurt. Если придут российские клиенты с проверкой 152-ФЗ — нужно либо on-prem, либо отдельный кластер в РФ (Yandex Cloud / VK Cloud).

**Что делать:**

- Договориться о позиционировании: «B2B-данные сотрудников и контрагентов — без явных ПДн физлиц». Переименовать поля так, чтобы было видно: `Organization.legalName`, `Organization.taxId` — реквизиты юрлиц/ИП, не ПДн физлица.
- Для физлиц-правообладателей (если они есть) — добавить отдельный поток с шифрованием PII at-rest (Postgres `pgcrypto`).
- Согласие на обработку ПДн: текущее `acceptedTermsAt` — да. Версионирование (`acceptedTermsVer`) — есть. Хорошо.

### 20. Поисковый и фильтрационный слой

Поиск везде — `ILIKE %q%` по 2–3 колонкам. На 50+ тыс. сделок это OK (Postgres tolerable), на 500+ тыс. — уже медленно. Никаких индексов FTS нет.

**Что делать:**

- Сейчас: добавить `pg_trgm` индексы по `Deal.title`, `Organization.legalName`, `Contract.number`.
- Когда понадобится — OpenSearch/Meilisearch для каталога.

---

## P2. Рекомендации (улучшение качества)

### 21. Версионирование `LicenseTerm` и `CatalogItem`

`docs/PRD.md` 4.2: «Версионирование метаданных каталога — отдельные ревизии с автором и временем». В схеме `LicenseTerm` нет `createdAt/updatedAt`, нет `revisionId` или связанной таблицы `CatalogItemRevision`. Для юр-фиксации «какой пакет прав был в каталоге на момент сделки» — недостаточно.

**Что делать:**

- `CatalogItemRevision (catalogItemId, version, payload Json, createdAt, createdByUserId)` + автомиграция на каждый патч.
- В Deal/Contract фиксировать `catalogItemRevisionId`, чтобы при изменении каталога старые сделки не плыли.

### 22. JSON-поля без схемы

`Organization.metadata`, `User.metadata`, `Deal.commercialSnapshot`, `Deal.dealDocuments`, `MaterialUpload.reviewerComment` — Json/jsonb. Парсятся местами по-разному (`(snap as Record<string, unknown>)`). Это ловушка для поддержки.

**Что делать:**

- На каждое JSON-поле — Zod-схема (или class-validator-клон) и хелпер `parseDealCommercialSnapshot(json) -> CommercialSnapshot`.
- В шапке `packages/core-domain` уже есть entities — синхронизировать.
- Где можно — нормализовать в отдельные колонки/таблицы (`User.phone` сейчас в `metadata` — кандидат на отдельную колонку с индексом).

### 23. Holder-кабинет: bell-индикатор и SSE/WS

В `holder-cabinet.md` `Что дальше` — это уже намечено. Хорошо. Стоит добавить также:

- Push-нотификации о платежах (когда выплата проведена, правообладатель часто хочет узнать сразу).
- Лента «Активность по моим тайтлам» агрегированно (новый запрос материалов, новая сделка, обновление статуса контракта).

### 24. UI/i18n

`docs/TECH_ARCHITECTURE.md` упоминает ru-KZ, ru-RU, en. В коде только `ru.ts` в `web/src/lib/i18n/`. Для CIS+EN — недостаточно. Email тоже только русские. Стандартный подход: react-intl или next-intl (поддерживают plurals/MessageFormat) + локализованные шаблоны писем.

**Что делать:**

- Перевести все строки в i18n-ключи (есть скрипт `scripts/check-ui-locale.mjs` — судя по названию, проверяет это).
- Локализовать `email-templates.ts` (preheader, CTA, paragraphs) с ключами `holder-invite.ru/en/kz`.
- Дать пользователю выбор языка в `/holder/profile` (поле `User.locale` уже есть, но похоже не используется).

### 25. Документ-генерация на LibreOffice

`Dockerfile` тянет LibreOffice внутрь runtime-образа. Это ~500 МБ только по бинарникам, и `soffice` запускается как тяжёлый процесс на каждую конвертацию. Для starter-плана 512 МБ RAM это легко OOM.

**Что делать:**

- Вынести генерацию PDF (`offer-template`, `platform-contract-template`) в отдельный микросервис `documents-worker` (или дать ему standby-инстанс) — пусть его OOM не валит API.
- Альтернативы: `puppeteer` + HTML-шаблоны, `wkhtmltopdf`, либо облачный сервис (Gotenberg). Gotenberg в Docker — лучший компромисс.

### 26. Архитектурные компромиссы

- **Модульный монолит — ОК**, но границы модулей размыты (ContractsService использует Email, EmailService использует Prisma напрямую). Внедрить «доменные события» вместо прямых вызовов между модулями: `ContractSignedEvent` → подписчик `EmailNotifier`, подписчик `TaskCloser`.
- **Hexagonal-стиль / репозиторий**: сейчас сервисы прямо лезут в Prisma. Это норм для скорости, но усложняет тестирование. Минимум — типизированные read-models.

### 27. Devops и наблюдаемость

- Нет `Sentry` / `OpenTelemetry`. Метрики только из health-эндпоинта.
- Структурированные логи: вижу `Logger` от Nest (+ `[EMAIL/...]` строковые). Лучше `pino` с JSON-форматом → Logflare/Better Stack/Grafana Loki.
- Алерты: нет. Базовое — алерт на 5xx > 1% за 5 минут, на «Postgres unreachable», на «email queue depth > N».
- Бэкапы: Render Postgres `basic-256mb` имеет дневные снапшоты (хорошо). Стоит проверять recovery: раз в квартал — drill «восстановить из снапшота на staging».

### 28. CI/CD

В корне нет `.github/workflows/` (по крайней мере не вижу). Каждый деплой — `git push` → Render билдит. Для прода желательно:

- GitHub Actions: lint + tsc + jest + e2e на PR.
- Preview-окружения: Render умеет PR Preview для `web`/`api` — стоит включить.
- `prisma migrate deploy` запускается в `CMD` Dockerfile. Это значит, что миграция выполняется при каждом старте инстанса. При нескольких инстансах — race condition (Prisma использует advisory lock, обычно ок, но нужно проверить). Лучше вынести миграцию в `preDeployCommand` Render.

### 29. OpenAPI/контракт

`openapi/contentflow-core.yaml` есть, но судя по `wc -l 382` — не покрывает всё API. Стоит:

- Авто-генерировать OpenAPI из Nest через `@nestjs/swagger`.
- Из OpenAPI — типизированный клиент для фронта (`openapi-typescript` или `orval`). Сейчас `web/src/lib/api.ts` — ручной обёртка, типы не привязаны к API.

### 30. Прочее

- `web/Dockerfile` вшивает `API_URL` build-time через `ARG`. Это значит, что один и тот же образ нельзя промоутить с staging на prod (разные API_URL). Лучше runtime-конфиг через `next-runtime-env` или прокси (фронт всегда стучит в `/v1/*`, который проксируется на API).
- Sub-domain isolation: PDF/материалы лучше отдавать с отдельного домена (`files.growixcontent.com`) чтобы XSS в SVG/HTML не задевал auth-cookie основного.
- `cookieParser()` подключён, а CSRF-токен — нет. Для запросов с `application/json` `sameSite=lax` достаточно, но для form-submit (multipart upload) — нет. Использовать `csurf` или Origin-check.
- В `holder-portal/holder.controller.ts:proposeTitle` — назначение задачи через «последний инвайтер»: при увольнении менеджера задачи отправляются мёртвому ящику. Нужен fallback на «менеджер аккаунта» или round-robin по активным.
- `Payout`-ы делаются вне контролера (создаются seed-ом или каким-то скриптом?). Нужно явное API «начислить выплату по контракту» с пересчётом всех royalty lines и лога.

---

## Приоритезированный план следующих 4 недель

**Неделя 1 (P0 critical-path):**

1. Закрыть RBAC-дыру: глобальный `RolesGuard` + `@Roles()` + e2e-тесты.
2. Token-revocation: `User.tokenVersion` + сокращённый TTL access-токена + refresh.
3. Money-domain: общая утилита для сумм, привести к ней contracts.service и финансовые расчёты.
4. Глобальный exception-filter: убрать утечку Prisma-сообщений на проде, поднять Sentry.

**Неделя 2 (P0 + P1):**

5. Подключить Hetzner SFTP в потоки uploads/downloads (материалы + контракты), добавить sha256-проверку при отдаче файлов.
6. Backed-by-DB email queue (BullMQ + Redis на Render), таблица `EmailDelivery`, статусы в UI.
7. CRM-аудит: общий AuditLog со списком значимых событий.

**Неделя 3 (P1):**

8. TaxEngine: справочник правил, расчёт withholding с фиксацией снапшота, напоминания за 30 дней.
9. FX-сервис с двумя источниками, кеш и фиксация в контракте.
10. CI: lint + tsc + jest на PR; убрать `ignoreBuildErrors` поэтапно.

**Неделя 4 (P1/P2):**

11. Перевести генерацию PDF в Gotenberg-микросервис; уменьшить runtime-образ API.
12. Версионирование `CatalogItem`/`LicenseTerm` (revisions).
13. Покрыть тестами: rights-validation, holder-scope, contracts.signByHolder, money-utils.

Дальше — webhooks (e-signature/1С), SSE/WS-уведомления, OpenSearch, локализации.

---

## Что уже сделано хорошо (чтобы не растерять)

- Чёткое разделение CRM ↔ кабинет правообладателя на уровне контроллеров и middleware.
- `HolderScopeService` как единственная точка доступа из holder-контроллера — отличный паттерн.
- `HolderInvite.tokenHash` (sha256), magic-link через JWT с aud — корректная реализация.
- `holderFinanceVisibility` с уровнями `limited`/`full` и per-user override — продуманный UX и compliance-ready.
- `assertEnv()` в `main.ts` — правильное «fail-fast» при отсутствии секретов.
- `app.set('trust proxy', 1)` — рабочий комментарий, видно, что прошли через грабли с throttler.
- Click-sign фиксирует IP/UA/sha256/version — юридически адекватно для простой ЭП.
- HTML-шаблоны писем единые, через `email-templates.ts`, с inline-стилями — Gmail/Outlook совместимо.
- `escapeForHtmlInline` в `holder.controller.ts:proposeTitle` — учли XSS в письмах.
- `MaterialRequestStatus.recompute` пересчитывает агрегатный статус по uploads — нет «забытых» состояний.
- Idempotent migrations с `IF NOT EXISTS`/`DO`-блоками — безопасно для прода.
- `next.config.ts` `middlewareClientMaxBodySize` под 2 ГБ — учли загрузки материалов.

---

## Открытые вопросы к команде

1. Single-tenant или скоро будет multi-tenant? От этого зависит, нужно ли срочно вводить `tenantId`.
2. Какой реальный ожидаемый размер мастер-копий (для лимита загрузки)?
3. Какой провайдер ЭП выбираем: Sign.Me / КонтурСайн / другой? От этого зависит схема `Contract` (КЭП требует доп. полей).
4. Куда летят финансовые события: 1С, Битрикс24, или кастом? От этого зависит формат outbox-событий.
5. Бренд `GROWIX` в письмах vs ContentFlow в коде — определиться, какой публичный, какой внутренний.
6. Локали: ru-RU, ru-KZ, en на запуск или этапно?

---

*Контакт по отчёту — добавьте в личку, какие пункты разбираем первым делом, и я подготовлю код-патчи для P0.*

---

## Изменения, внесённые автоматически (30.04.2026)

Закрыт полный объём P0 и большая часть P1. P2 — преимущественно в рекомендациях, без кода.

### P0 — закрыто

1. **RBAC (`api/src/auth/roles.guard.ts`, `roles.decorator.ts`).** Новый `RolesGuard` подключён глобально в `app.module.ts` после `JwtAuthGuard` с поведением **default-deny**: эндпоинт без `@Roles(...)` отказывает в доступе. Декораторы навешены на все контроллеры:
   - `admin/manager`: deals, contracts, catalog (items + export), tasks, commercial-offers, finance, organizations, users, material-requests (CRM-сторона), holder-auth (создание/листинг инвайтов).
   - `rights_owner`: holder (на класс).
   - `admin`: hetzner-storage (admin/storage), debug.
   - `admin/manager/rights_owner`: portal/rights-owner.
   - `AllowAnyAuthenticatedRole()`: auth/me, health.
2. **Token revocation (`User.tokenVersion`).** Поле + миграция `20260430120000_user_token_version`. JWT-payload теперь содержит `tv`; `JwtStrategy.validate` сверяет с актуальным значением и отказывает при расхождении. `AuthService.bumpTokenVersion(userId)` инкрементирует версию. Новый эндпоинт `POST /v1/auth/logout-all` и обновлённый `web/src/app/api/auth/logout/route.ts` (стирает cookie + дёргает logout-all). TTL access-токена снижен с 7 дней до 12 часов.
3. **Money-domain (`api/src/common/money.ts`).** Утилиты `toDecimal`, `sumDecimal`, `roundDecimal`, `percentOf`, `mulDecimal`, `moneyToString`. В `contracts.service.ts` все `parseFloat` для денег заменены на Decimal-арифметику.
4. **Exception filter.** Маскирует Prisma-сообщения в проде, генерирует `traceId` для каждого 500, пишет полный stack только в логи, возвращает клиенту `{statusCode, message, traceId, path}`.
5. **PDF-плейсхолдер + sha256.** В проде вместо плейсхолдера 503; при отдаче файла сверяется sha256 с `ContractVersion.sha256`, при расхождении — critical-лог + 503 в проде.
6. **Magic-link redirect.** Жёсткая валидация: парсинг через `URL`, только `/holder` или `/holder/...`, защита от `//`, `\r\n\t`, чужого host. `EmailService.buildWebUrl` корректно обрабатывает CSV `WEB_ORIGIN` (берёт первый origin как canonical).
7. **Секреты.** Удалён `api/.env`. Расширен корневой `.gitignore`, создан `api/.gitignore`. В `.env.example` placeholder `JWT_SECRET` помечен как требование `openssl rand -hex 48`.

### P1 — закрыто

8. **Throttler.** Дефолтный лимит снижен до 600 rpm. Группа `heavy` (30 rpm) на тяжёлые эндпоинты: экспорт каталога, скачивание контрактов и материалов.
9. **Лимит multipart + MIME.** Снижен с 100 ГБ до 4 ГБ. Per-slot лимиты приведены к адекватным. Добавлены `allowedExtensions` (whitelist) и `detectFileSignature(head)` — проверка магических байтов в `MaterialRequestsService.addUpload` блокирует подмену расширения.
10. **CRM Audit Log.** Модель `CrmAuditLog` + миграция. Глобальный `CrmAuditService` (Module: `AuditModule`, `@Global()`). Подключён в: contracts.create/patch/archive/delete, organizations.holder-visibility/holder-user-visibility/contact-card. Команда дошьёт остальные точки по образцу.
11. **EmailDelivery.** Модель `EmailDelivery` + статусы (pending/sent/failed/skipped). `EmailService.send` пишет каждую попытку в БД. Метод `retryFailed(maxAttempts=3)` для cron-ретрая. Skip при opt-out тоже фиксируется.
12. **assertEnv.** Минимум 48 символов `JWT_SECRET` в проде, запрет placeholder-строк, требование `WEB_ORIGIN` в проде, `EMAIL_FROM` обязателен при `SMTP_URL`.
13. **proposeTitle fallback.** `pickAssigneeForOrg`: 1) проверка, что инвайтер всё ещё активный manager/admin; 2) распределение на наименее загруженного активного менеджера через groupBy task-count; 3) admin как fallback.
14. **TaxEngine — каркас.** Модель `TaxRule` + enum `WithholdingIncomeType` + 3 fallback-правила в миграции. `TaxEngineService.computeWithholding(input)` с приоритетом manual override → treaty rate (если cert valid) → default rate → глобальный fallback 20%. Глобальный `TaxModule`.
15. **FxRateService — каркас.** Модель `FxRateCache` + `FxService` с двухуровневым кешем (mem 60 сек, БД 24 ч). Адаптеры CBR/NBK/ECB — заглушки с понятными сообщениями (готовы к подключению парсеров отдельным PR).
16. **Hetzner-fallback для контрактов.** При скачивании, если файла нет на локальном диске Render, сервис пробует стянуть из `${HETZNER_CONTRACTS_DIR}/<storageKey>` (по умолчанию `/contentflow/contracts`), восстанавливает на локальный диск, считает sha256 и отдаёт.

### Что осталось (намеренно вне этого прохода)

- Полное покрытие CRM-аудита всеми мутациями (deals/finance/material-requests/catalog/commercial-offers) — тривиальные правки по образцу.
- Реальные адаптеры FX (CBR XML / NBK / ECB) и подключение `TaxEngine` в `Payouts` (модуль ещё не существует в кодовой базе).
- Refresh-токены (требует UI-изменений; сейчас защита через `tokenVersion` + TTL 12 ч).
- BullMQ + Redis-очередь, версионирование Catalog/LicenseTerm, локализация писем, Gotenberg, pre-signed S3 URL, e-signature webhooks, Sentry/OTel, CI с tsc/jest, удаление `ignoreBuildErrors`.

### Применение миграций

В `api/prisma/migrations/` добавлены три новые папки:

- `20260430120000_user_token_version`
- `20260430130000_crm_audit_email_delivery`
- `20260430140000_tax_rules_fx_cache`

Все миграции идемпотентны (`IF NOT EXISTS`, `DO $$ ... EXCEPTION WHEN duplicate_object THEN NULL`). На Render применятся автоматически при следующем деплое (в `api/Dockerfile` стоит `prisma migrate deploy`). Локально:

```bash
cd api
npm install
npx prisma migrate deploy
npx prisma generate
npm run start:dev
```

Важно: после применения миграции `tokenVersion` все ранее выпущенные JWT станут невалидными (в payload нет `tv`), пользователи увидят `401`. Это разовая операция, при следующем входе всё заработает.

### Файлы, которые добавились

```
api/src/auth/roles.decorator.ts
api/src/auth/roles.guard.ts
api/src/audit/crm-audit.service.ts
api/src/audit/audit.module.ts
api/src/common/money.ts
api/src/tax/tax-engine.service.ts
api/src/tax/tax.module.ts
api/src/fx/fx.service.ts
api/src/fx/fx.module.ts
api/.gitignore
api/prisma/migrations/20260430120000_user_token_version/migration.sql
api/prisma/migrations/20260430130000_crm_audit_email_delivery/migration.sql
api/prisma/migrations/20260430140000_tax_rules_fx_cache/migration.sql
```

### Файлы, удалённые

```
api/.env   (содержал dev-секреты, попадал в zip-архив)
```

---

## Второй автоматический проход (30.04.2026)

Доделано всё, что физически делается без бизнес-решений и внешних креденшелов.

### Что добавилось

**Полное покрытие CRM-аудита.** `audit.log({...})` теперь стоит во всех CRM-мутациях:
- `deals`: create / patch / archive / duplicate / delete
- `contracts`: create / patch / archive / unarchive / delete (было)
- `catalog`: create / patch / delete
- `commercial-offers`: create / create_manual / archive / delete
- `tasks`: delete
- `material-requests`: create / cancel / review
- `organizations`: holder-visibility / holder-user-visibility / contact-card (было)

В `CrmAuditLog` будут писаться все значимые действия менеджеров — на случай юр-разборов и внутреннего аудита.

**Реальные FX-парсеры.** `FxService.fetchCbr/fetchNbk/fetchEcb` — рабочая реализация:
- CBR: `https://www.cbr.ru/scripts/XML_daily.asp` (windows-1251 → UTF-8 через `TextDecoder`)
- NBK: `https://nationalbank.kz/rss/get_rates.cfm`
- ECB: `https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml`

Парсеры на регулярках (без внешних xml-зависимостей), кросс-курсы считаются через базовую валюту источника (RUB / KZT / EUR). Через env `FX_SOURCE=CBR|NBK|ECB` выбирается активный источник. Кеш на 60 секунд (in-memory) + 24 часа (БД, `FxRateCache`). При недоступности API — fallback на устаревший кеш с warning-логом. `__testables` экспортируется для unit-тестов.

**Hetzner-зеркало контрактов при создании.** Теперь при создании версии контракта (и в `ContractsService.createDraft`, и в `DealsService.syncUploadedPdfToLatestContractVersion`) файл сразу пушится в Hetzner Storage Box (best-effort, без сбоя бизнес-операции). Это делает fallback-восстановление при чтении реальным, а не теоретическим. Путь по умолчанию: `${HETZNER_CONTRACTS_DIR}/contracts/<id>/v<n>.pdf`.

**GitHub Actions CI** (`.github/workflows/ci.yml`). Два независимых джоба:
- `api`: install → prisma generate → lint → tsc → migrate deploy → npm test → npm run test:e2e (с поднятым postgres-сервисом).
- `web`: install → lint → tsc → build.

Lint и tsc на web пока с `|| true` (потому что в `figma/pages/*` ещё лежит долг). После уборки долга — снять флаг, и CI станет блокирующим.

**Cron** (`api/src/cron/cron.service.ts`, `cron.module.ts`). Реализован на нативном `setInterval` без `@nestjs/schedule`, чтобы не тащить новую зависимость. Две задачи:
- `email-retry`: каждые 5 минут вызывает `EmailService.retryFailed(3, 50)` — добивает «застрявшие» письма.
- `tax-cert-expiry`: раз в 24 часа сканирует `TaxProfile.validUntil`, создаёт `Task` менеджеру за 30 дней до истечения сертификата ДВН (или сразу, если уже просрочен). Защита от дубликатов — проверка существующей открытой задачи на `linkedEntityType='taxProfile'`.

Управляется через env: `DISABLE_CRON=1` отключает cron полностью (нужно для CI и при горизонтальном масштабе, чтобы избежать дублирования; для distributed cron позже — BullMQ или advisory lock).

**assertEnv: предупреждение про Hetzner.** В проде, если не задан `HETZNER_STORAGE_PASSWORD`, выводится громкий warning при старте: «зеркалирование контрактов отключено, потеря Render disk = потеря всех договоров». Это не блокирует запуск (deploy без Hetzner возможен), но делает риск явным.

### Финал состояния tsc

После применения миграций и `prisma generate`, `tsc --noEmit` чист по моему коду. Остаются только старые ошибки в `test/*.spec.ts` (типы supertest), которые существовали до моих правок, — это не блокирует ни сборку, ни деплой.

### Файлы, добавившиеся во втором проходе

```
.github/workflows/ci.yml
api/src/cron/cron.service.ts
api/src/cron/cron.module.ts
```

### Файлы, изменённые во втором проходе

```
api/src/app.module.ts                                       (CronModule)
api/src/main.ts                                             (Hetzner warning)
api/src/fx/fx.service.ts                                    (CBR/NBK/ECB парсеры)
api/src/contracts/contracts.service.ts                      (Hetzner mirror на createDraft)
api/src/deals/deals.service.ts                              (Hetzner mirror на загрузке PDF)
api/src/deals/deals.module.ts                               (HetznerStorageModule)
api/src/deals/deals.controller.ts                           (CRM-аудит)
api/src/finance/finance.controller.ts                       (CRM-аудит)
api/src/catalog/catalog.controller.ts                       (CRM-аудит)
api/src/tasks/tasks.controller.ts                           (CRM-аудит)
api/src/commercial-offers/commercial-offers.controller.ts   (CRM-аудит)
api/src/material-requests/material-requests.controller.ts   (CRM-аудит)
```

### Что в проекте осталось вне моей зоны влияния

Всё, что требует бизнес-решений или ваших креденшелов:

- **Деплой на Render.** Делается вашим `git push`. Я подготовил CI, который проверит сборку до этого.
- **Сменить `JWT_SECRET` в Render.** Только вы — у меня нет доступа к консоли Render.
- **Sentry/OpenTelemetry.** Нужен ваш DSN. Когда появится — это 5 строк в `main.ts`.
- **BullMQ/Redis.** Только если ваших объёмов хватит, чтобы оправдать $10/мес за Redis. Сейчас встроенный cron-retry достаточен.
- **Электронная подпись (Sign.Me / КонтурСайн / DocuSign).** Бизнес-решение про юр-контракт.
- **1С-интеграция.** Зависит от формата вашего обмена (CommerceML / EnterpriseData / прямой).
- **Локализации.** Нужны переводчики-носители, не машинный перевод.
- **Pre-signed S3 URL.** Только если действительно нужны мастер-копии >4 ГБ через UI.
- **Уборка `ignoreBuildErrors` в `web/next.config.ts`.** Требует переписать `figma/pages/*` — это многодневная работа, которую разумно делать команде, а не скриптом.
