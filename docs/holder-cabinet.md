# Кабинет правообладателя

B2B-портал для редкой категории пользователей: правообладатели заходят
1–4 раза в месяц, чтобы посмотреть статус, скачать договор или загрузить
материалы. Архитектура спроектирована так, чтобы:

- утечка данных одной организации не привела к утечке другой (жёсткий scope);
- логин был дружелюбным к мобильным и не требовал помнить пароль (magic-link);
- любые критичные действия фиксировались в журнале для юр. разборов.

## Что готово (Итерация 1 — «Информационное окно»)

### Бэкенд

- Prisma-миграция `20260426094541_add_holder_cabinet`:
  - Поля `User`: `metadata`, `invitedAt`, `invitedByUserId`, `acceptedTermsAt`,
  `acceptedTermsVer`, `lastLoginAt`, `lastLoginIp`, индексы.
  - Новые таблицы: `HolderInvite`, `HolderAuditLog`, `MaterialRequest`,
  `MaterialUpload`. Енумы `MaterialRequestStatus`, `MaterialReviewStatus`.
  - Миграция идемпотентна (`IF NOT EXISTS`/`DO`-блоки), безопасна для прода.
- Модуль `api/src/holder-auth/`:
  - `POST /v1/auth/holder/invites` — менеджер создаёт инвайт-токен (sha256-хеш в БД).
  - `GET  /v1/auth/holder/invites?orgId=…` — список инвайтов и активных пользователей.
  - `GET  /v1/auth/holder/invites/preview?token=…` — превью для страницы приёма (публичный).
  - `POST /v1/auth/holder/invites/claim` — приём инвайта, создание/обновление User (публичный, throttled).
  - `POST /v1/auth/holder/magic-link/request` — отправка одноразовой ссылки на email (публичный, throttled).
  - `POST /v1/auth/holder/magic-link/verify` — верификация magic-link (публичный, throttled).
- Модуль `api/src/holder-portal/`:
  - `HolderGuard` — пускает только `rights_owner` с `organizationId`.
  - `HolderScopeService` — все запросы фильтруются по `organizationId` пользователя.
  - `HolderAuditService` — пишет действия в `HolderAuditLog`.
  - Эндпоинты:
    - `GET  /v1/holder/me` — профиль + флаг `onboardingComplete`.
    - `POST /v1/holder/me/accept-terms` — повторное согласие.
    - `GET  /v1/holder/dashboard` — счётчики: тайтлы, активные сделки, договоры в работе, выплаты всего, последняя выплата.
    - `GET  /v1/holder/catalog-items` и `GET /v1/holder/catalog-items/:id`.
    - `GET  /v1/holder/deals` и `GET /v1/holder/deals/:id` (без `commercialSnapshot` и без owner-менеджера).
    - `GET  /v1/holder/payouts`.
    - `GET  /v1/holder/contracts`.

### Фронтенд

- Middleware `web/src/middleware.ts`:
  - публичные `/holder/login`, `/holder/accept`, `/holder/auth/verify`;
  - `rights_owner` — редирект на `/holder` со всех остальных страниц;
  - не-`rights_owner` — редирект с `/holder/*` на `/`.
- Структура `web/src/app/holder/*`:
  - `login` — вход по magic-link или паролю.
  - `accept` — приём инвайта (имя/телефон/пароль/согласие).
  - `auth/verify` — верификация magic-link, выставление cookie.
  - `onboarding` — повторное согласие для уже существующих пользователей.
  - `page.tsx` — дашборд (4 карточки + последняя выплата).
  - `titles`, `deals`, `payouts`, `contracts` — списки.
  - `HolderShell` — навигация (sidebar, mobile-drawer, logout).
  - `HolderOnboardingGate` — редиректит на `/holder/onboarding`, если `acceptedTermsAt` пуст.
- CRM-сторона: страница `/counterparties` со списком правообладателей,
раскрытием карточки (активные пользователи + история инвайтов) и кнопкой
«Пригласить». При создании генерируется одноразовая ссылка
`/holder/accept?token=…`, которую менеджер копирует и отправляет. Ссылка
на email пока не отсылается — это пункт Итерации 3 (`EmailService`).

## Безопасность

- Сырой токен инвайта возвращается из API ровно один раз (на создании).
В БД хранится только `sha256(rawToken)`, утечка БД не выдаёт активные ссылки.
- Magic-link — JWT с `aud: "holder-magic"` и TTL 15 минут.
- `HolderGuard` блокирует не-`rights_owner` и пользователей без `organizationId`.
- `HolderScopeService` — единственный точка доступа к данным; контроллеры не
ходят в Prisma напрямую, чтобы фильтр по `organizationId` нельзя было пропустить.
- `HolderAuditLog` фиксирует логин (по паролю/magic-link), просмотр сделок,
тайтлов, скачивание договоров (Итерация 2), подпись (Итерация 3).
- Frontend middleware жёстко отделяет `/holder/*` от CRM-раздела на уровне
редиректов — закладкой не попасть.

## Что готово (Итерация 2 — «Загрузка материалов и скачивание договоров»)

### Бэкенд

- Модуль `api/src/material-requests/`:
  - Каталог слотов (`material-slots.ts`): 14 предустановленных типов
  (`master_video`, `preview_video`, `trailer`, `poster`, `banner`,
  `still`, `subtitles_*`, `dub_audio`, `synopsis`,
  `chain_of_title`, `music_clearance`, `tech_specs`).
  Для каждого слота — лимит размера, MIME-фильтр, описание.
  - `MaterialRequestsService`:
    - CRM: `createForCatalogItem`, `listForCatalogItem`, `update`,
    `cancel`, `reviewUpload`.
    - Holder: `listForHolder`, `findForHolderOrFail`, `addUpload`,
    `deleteUploadByHolder`, `getUploadFileMeta`.
    - `recomputeStatus(requestId)` — пересчитывает статус
    (`pending → partial → complete`) после каждой загрузки/ревью.
  - REST (CRM, требует JWT, доступно менеджеру/админу):
    - `GET  /v1/material-slots` — каталог типов.
    - `GET  /v1/material-requests?catalogItemId=…` или `?status=…`.
    - `POST /v1/material-requests` — создать запрос.
    - `GET  /v1/material-requests/:id`, `PATCH`, `DELETE`.
    - `POST /v1/material-requests/:id/uploads/:uploadId/review`
    (approve/reject + комментарий).
    - `GET  /v1/material-requests/:id/uploads/:uploadId/download`.
  - REST (holder, под `HolderGuard`):
    - `GET  /v1/holder/material-slots`,
    `GET  /v1/holder/material-requests?activeOnly=1`,
    `GET  /v1/holder/material-requests/:id`.
    - `POST /v1/holder/material-requests/:id/uploads` — `multipart/form-data`,
    поле `file`, поле `slot`. Лимит `4 ГБ`, фильтр по MIME слота.
    - `DELETE /v1/holder/material-requests/:id/uploads/:uploadId` —
    удалить только не отревьюенную загрузку.
    - `GET  /v1/holder/material-requests/:id/uploads/:uploadId/download`.
- Контракты:
  - `ContractsService.latestVersionNumber(contractId)`.
  - `GET /v1/holder/contracts/:id/download?version=…&inline=…` —
  стримит PDF, проверяет принадлежность через `HolderScopeService`,
  пишет `download_contract` в `HolderAuditLog`.
- Magic-link `redirect`:
  - DTO `RequestMagicLinkDto` принимает `redirect: string` (только `/holder/*`).
  - В DEV/staging контроллер возвращает `magicUrl` — это нужно для QR-флоу
  «продолжить с телефона» без работающего SMTP. На проде ссылка не отдаётся.

### Фронтенд

- `/holder/materials`:
  - Список запросов, фильтр «активные / все», группировка
  «открытые / завершённые». Показывает прогресс `approved / requested`.
- `/holder/materials/[id]`:
  - Полная карточка: тайтл, статус, срок, комментарий менеджера.
  - Чек-лист по слотам: для каждого — описание, лимит, список ранее
  загруженных файлов с статусом ревью и комментарием менеджера.
  - Зона drag-and-drop с прогресс-баром (XHR upload-progress).
  - Удаление своей не отревьюенной загрузки.
  - Кнопка «Продолжить с телефона» — модал с QR-кодом, ведущим на
  эту же страницу через magic-link.
- `/holder/contracts`:
  - В таблицу добавлена колонка «Документ» с кнопкой «Скачать»;
  скачивание стримит последнюю версию через
  `/v1/holder/contracts/:id/download` (audit-log).
- `web/src/app/holder/auth/verify/page.tsx`:
  - Поддерживает `?next=/holder/...` и редиректит на безопасный путь.
- CRM:
  - В `CatalogItemDetail` добавлена секция «Запросы материалов»
  (`CatalogItemMaterialRequests.tsx`):
    - Список запросов, раскрываемый по клику.
    - Модалка «Запросить материалы»: групповой чек-лист слотов,
    срок, комментарий.
    - Для каждой загрузки — кнопки «Принять» / «Отклонить» с
    опциональным комментарием, скачивание файла.
    - Кнопка «Удалить запрос» (только если нет одобренных загрузок).

### Безопасность

- Загрузки кладутся в `${UPLOAD_DIR}/materials/{requestId}/{uuid}{ext}` —
имена файлов на диске не совпадают с пользовательскими, что защищает
от path-traversal и угаданных URL.
- Перед сохранением файла в БД: проверяется slot (whitelisted), MIME
(по prefix-у слота), размер; иначе файл удаляется с диска.
- Скачивание контракта проверяет связь `Contract.royaltyLines.rightsHolderOrgId`
с `user.organizationId` — другую организацию не получится открыть.
- `HolderAuditLog` пишет событие `download_contract` с `entityId`,
`version`, `ip`, `userAgent`. Аналогично — `upload_material`
(создание/удаление).
- Magic-link `redirect` дополнительно валидируется в браузере (must start
with `/holder` и не быть protocol-relative) — нельзя увести на чужой домен.

## Итерация 3 — реализовано

### EmailService (`api/src/email/`)

- Глобальный `EmailModule` с `EmailService`. Транспорт берётся из `SMTP_URL`,
если не задан — режим **console**: письма не уходят, а пишутся в лог.
Отправка best-effort: ошибки SMTP не валят бизнес-операции.
- Адрес отправителя: `EMAIL_FROM` или `noreply@<host из WEB_ORIGIN>` или
`noreply@growix.local` как последний fallback.
- Используется в:
  - **holder-invite** (создание инвайта менеджером) — письмо со ссылкой
  `/holder/accept?token=…`. В ответе API теперь возвращается `acceptUrl`,
  чтобы менеджер мог дополнительно скопировать и переслать ссылку вручную.
  - **magic-link** (`/v1/auth/holder/magic-link/request`) — письмо со ссылкой
  `/holder/auth/verify?token=…&next=…`. Раньше ссылка попадала только в
  логи; теперь — в email.
  - **contract-signed** — уведомление менеджеру (`Deal.owner.email`)
  после click-sign правообладателем.
  - **title-proposed** — уведомление менеджеру о новом предложении тайтла.

### Click-sign договора правообладателем

Schema:

- `Contract.holderSignedByUserId`, `holderSignedAt`, `holderSignedIp`,
`holderSignedUserAgent`, `holderSignedVersion`, `holderSignedHash`,
`holderSignedTermsVer` — фиксируем «слепок» подписи.
- Миграция: `prisma/migrations/20260426105500_iter3_holder_sign_and_visibility/`.

API:

- `POST /v1/holder/contracts/:id/sign` (под `HolderGuard`).
Body: `{ consent: boolean, termsVersion: string }`.
Проверки:
  - `consent === true`;
  - контракт принадлежит организации (через `RoyaltyLine.rightsHolderOrgId`);
  - текущий статус `sent`;
  - есть хотя бы одна `ContractVersion`.
  Действие в транзакции:
  - переводит `Contract.status = signed`;
  - заполняет `holderSigned`* (ip/UA/версия/sha256/termsVer);
  - проставляет `ContractVersion.signedAt`;
  - закрывает все открытые `Task` по этому контракту.
- Audit: `sign_contract` со снимком (version, sha256, termsVersion).
- После подписи — best-effort email менеджеру (`Deal.owner.email`).

UI (`/holder/contracts`):

- Кнопка «Подписать» доступна только для статусов `sent` без подписи.
- Модал с явным согласием (галка), показывает условия click-sign,
ссылку на скачивание PDF договора, версию пользовательского соглашения
(передаётся в `termsVersion`).
- В таблице рядом со статусом отображается «подписано вами DD.MM.YYYY (vN)»
если `holderSignedAt` заполнен.

### «Предложить тайтл»

API:

- `POST /v1/holder/proposals` — DTO `ProposeTitleDto`
(title, kind, productionYear, countryOfOrigin, description,
rightsAvailable, contactPhone).
- Создаёт `Task` (`type=custom`, `priority=medium`, `dueAt = +5 дней`)
на менеджера. Назначение: тот, кто последним приглашал кого-то
в эту организацию (`HolderInvite.invitedByUserId`); fallback —
любой `manager`/`admin`.
- Audit: `propose_catalog_item` со snapshot полей.
- Email менеджеру с описанием заявки.

UI:

- Новая страница `/holder/propose` — форма с полями + успех-стейтом
«Заявка отправлена».
- В навигацию `HolderShell` добавлен пункт «Предложить тайтл» (`Lightbulb`).

### Видимость финансов

Schema:

- Enum `HolderFinanceVisibility { limited, full }`.
- `Organization.holderFinanceVisibility` (default `limited`) — настройка по компании.
- `User.holderFinanceOverride` (optional, тот же enum) — для представителя
  правообладателя: если `null`, наследуется `Organization.holderFinanceVisibility`.
- Миграция `user_holder_finance_override` добавляет поле в `User`.

Бэкенд (`HolderScopeService`):

- `getEffectiveFinanceVisibility(userId, orgId)` — итоговый уровень: override
  пользователя или настройка организации.
- `listPayouts(orgId, viewerUserId)` возвращает
`{ items, financeVisibility }` с `financeVisibility` по **текущему** представителю. В `limited` суммы вырезаются из ответа
(остаются `id`, `currency`, `createdAt`, `contract`).
- `dashboardCounters(orgId, viewerUserId)` — `financeVisibility` по
текущему представителю, `payoutsCount`, и в `limited` режиме `payoutsTotal=null`,
`lastPayout` без `amount`.

CRM API:

- `PATCH /v1/organizations/:id/holder-visibility` — настройка **по компании**.
  Body: `{ visibility: 'limited' | 'full' }` (роль `manager` | `admin`).
- `PATCH /v1/organizations/:id/holder-representatives/:userId/visibility` —
  индивидуальная настройка представителя. Body: `{ visibility: 'inherit' | 'limited' | 'full' }`.

Список инвайтов/представителей:

- `GET /v1/auth/holder/invites?orgId=…` — в каждом пользователе: `holderFinanceOverride`,
`effectiveHolderFinance`, плюс `orgHolderFinanceVisibility` по организации.

CRM UI (`/counterparties`):

- Переключатель уровня по компании (как раньше).
- У каждого активного представителя — выпадающий список: «как у компании»,
«без сумм» или «полный доступ».
- Ошибки откатываются перезагрузкой списка.

UI кабинета:

- `/holder` (dashboard): карточка «Выплаты» в `limited` показывает
количество, в `full` — сумму. Под карточками подсказка про
ограниченный доступ.
- `/holder/payouts`: жёлтый баннер про ограниченный доступ,
колонки сумм скрыты в `limited`.
- `/holder/contracts`: без изменений (там и так нет сумм).

## Итерация 4 — коммуникации и прозрачность

Что добавили на этой итерации:

### HTML-шаблоны писем

- `api/src/email/email-templates.ts` — фирменная HTML-обёртка с шапкой
GROWIX, telecaster CTA-кнопкой, деталями (label/value таблицей)
и preheader-текстом. Inline-стили — для совместимости с Gmail/Outlook.
- `EmailService.sendTemplated({...})` — высокоуровневый шорткат, который
рендерит шаблон в html+text и зовёт обычный `send`. Все существующие
письма (magic-link, invite, контракт подписан, предложение тайтла)
переведены на новый рендер.
- Параметр `respectUserPrefs: true` пропускает отправку, если пользователь
снял галку «Получать уведомления» в `/holder/profile`. Транзакционные
письма (вход, инвайт, подтверждение подписи) шлются всегда.

### Email на события material-request

- При создании запроса (`POST /v1/material-requests`) уведомляются все
активные пользователи правообладательской организации.
- При ревью загрузки (`PATCH .../uploads/:uploadId/review`) — то же,
с разными темами (принят / отклонён) и комментарием менеджера.
- Когда все слоты переведены в `approved` (`recomputeStatus` →
`complete`), уведомление уходит автору запроса (менеджеру).
- Реализовано в `MaterialRequestsService` через `EmailService.sendTemplated`
и `respectUserPrefs: true`.

### История действий в CRM

- `GET /v1/organizations/:id/audit?limit=N` — отдаёт записи `HolderAuditLog`
по организации (по убыванию даты, лимит ≤100).
- В карточке контрагента (`/counterparties` → раскрытая карточка) — секция
«История действий» с ленивой подгрузкой при первом раскрытии. Показывает
кто/когда/что (login, view_contract, sign_contract, upload_material,
update_profile и т.д.).

### Профиль правообладателя

- `GET /v1/holder/me` теперь возвращает `phone` и `notificationsEnabled`
(оба живут в `User.metadata`, отдельных колонок нет).
- `PATCH /v1/holder/me` принимает любые из полей `displayName`, `phone`,
`notificationsEnabled` и обновляет точечно. Записывает аудит
`update_profile` со списком реально изменённых полей.
- `/holder/profile` — страница c формой (имя / телефон / тогл уведомлений).
Email — только на чтение (это идентификатор). В сайдбаре кабинета
появился пункт «Профиль» (иконка `UserCircle`).

### Уважение `notificationsEnabled`

- `EmailService` при `respectUserPrefs: true` смотрит
`user.metadata.notificationsEnabled` для адресата. Если `false` —
письмо не отправляется, в логах появляется
`[EMAIL/<category>] skipped (user opted out)`.

## Что дальше

- Дополнительные локализации писем (en/ru/kz) — сейчас все письма
русскоязычные.
- Настоящая ЭЦП: интеграция с КриптоПро / Sign.Me — поверх click-sign
(текущий click-sign — простая ЭП по 63-ФЗ).
- Bell-индикатор «новые события» в шапке /holder/* (push-уведомления
через WebSocket / Server-Sent Events).
- Лента «активность правообладателя» в кабинете менеджера (общая, не
по конкретной организации).
- Авто-генерация HTML-писем для оставшихся CRM-сценариев (новая
сделка, изменение статуса контракта менеджером и т.д.).

## Применение миграции

На Render миграция применится автоматически при следующем деплое
(`prisma migrate deploy` в `api/Dockerfile`). Локально:

```bash
cd api
npm run db:migrate
```

Или, если вы работаете через `prisma db push`:

```bash
cd api
npx prisma db push
```

