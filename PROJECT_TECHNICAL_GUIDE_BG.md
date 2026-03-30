# Техническо описание на проекта

Версия на описанието: snapshot на standalone репото към commit `7998af0` от 2026-03-30

## 1. Обхват и цел

Този документ описва текущото съдържание на репото `service-platform` така, че нов програмист или AI агент да може бързо да:

- разбере, че това вече е самостоятелен проект;
- стартира системата локално;
- намери правилните файлове за промяна;
- спази критичните бизнес правила и ограничения за достъп;
- продължи развитието без да наруши текущата архитектура.

Най-важният извод е:

- това repo вече е отделеният активен продукт;
- в него няма legacy root вариант с отделни `backend/` и `frontend/` за старата PyOffers линия;
- всички основни runtime части са в root структурата: `backend/`, `frontend/`, `mobile-app/`.

## 2. Високо ниво на продукта

`service-platform` е service-centered платформа, изградена върху домейн идеи от PyOffers, но вече развивана като отделен GitHub проект.

Основните продуктови области са:

- сервизни заявки;
- назначаване на техници;
- work logs;
- travel logs;
- разход на материали;
- складове;
- оборудване по обекти;
- billing/service projects към клиенти и обекти;
- сервизни протоколи с preview, PDF и подписи;
- notifications;
- granular permission model;
- отделно mobile приложение за техници.

Offers модулът остава наличен, но вече е вторичен спрямо service workflow-а.

## 3. Структура на репото

### 3.1 Основни top-level директории

- `backend/`: FastAPI backend на активния продукт.
- `frontend/`: основният web frontend.
- `mobile-app/`: отделен technician/mobile frontend.

### 3.2 Основни top-level файлове

- `README.md`: общо описание на самостоятелния проект.
- `IMPLEMENTATION_PLAN.md`: архитектурна и продуктова посока.
- `MOBILE_IMPLEMENTATION_PLAN.md`: mobile direction и фази.
- `TICKET_PROMPT.md`: технически prompt/instructions за AI-driven работа по проекта.
- `client.md`: домейн контекст за клиента.
- `mobile_app.md`: mobile scope и очаквания.
- `work_process.md`: работен процес и бизнес насоки.
- `HTTPS_SETUP.md`: локален HTTPS setup с Caddy.
- `docker-compose.yml`: локален multi-container runtime.
- `Caddyfile`: HTTPS reverse proxy конфигурация.
- `.env.example`: root env пример за HTTPS/public host setup.

## 4. Технически стек

## 4.1 Backend

- Python
- FastAPI
- SQLAlchemy ORM
- Alembic
- PostgreSQL
- Pydantic / pydantic-settings
- JWT auth чрез `python-jose`
- Password hashing чрез `passlib[bcrypt]`
- PDF генерация чрез WeasyPrint + Jinja2
- Excel import чрез `openpyxl`
- Tests чрез `pytest`

Файл: [backend/requirements.txt](backend/requirements.txt)

## 4.2 Web frontend

- React 19
- TypeScript 5.9
- Vite 7
- Material UI 7
- TanStack React Query 5
- React Router 7
- React Hook Form
- Zod
- i18next
- Axios

Файл: [frontend/package.json](frontend/package.json)

## 4.3 Mobile frontend

- React 19
- TypeScript 5.9
- Vite 7
- Material UI 7
- TanStack React Query 5
- Capacitor 7
- Axios
- i18next
- `@zxing/browser` за barcode scanning

Файл: [mobile-app/package.json](mobile-app/package.json)

## 4.4 Infrastructure

- Docker Compose
- PostgreSQL 15 Alpine
- Caddy 2.8 за локален HTTPS reverse proxy

Файлове:

- [docker-compose.yml](docker-compose.yml)
- [Caddyfile](Caddyfile)
- [HTTPS_SETUP.md](HTTPS_SETUP.md)

## 5. Текущ snapshot на кода

Към commit `7998af0` проектът съдържа приблизително:

- 21 backend model файла;
- 16 backend router файла;
- 7 backend service файла;
- 12 schema файла;
- 19 Alembic миграции;
- 5 backend test файла;
- 23 web page файла;
- 9 mobile page файла.

Това е полезен ориентир, а не твърд архитектурен договор.

## 6. Runtime архитектура

## 6.1 Контейнери и портове

[docker-compose.yml](docker-compose.yml) стартира:

- `https-proxy` на `443`, `3443`, `8443`;
- `db` на `localhost:5432`;
- `backend` на `localhost:8000`;
- `frontend` на `localhost:3000`;
- `mobile-app` на `localhost:3001`.

HTTPS reverse proxy-то служи главно за:

- browser secure context;
- camera API достъп на мобилни устройства;
- по-реалистична локална среда за mobile/web тестове.

## 6.2 Backend startup

Backend контейнерът изпълнява:

```sh
alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Това означава:

- миграциите се прилагат автоматично при container startup;
- локалният runtime разчита на автоматично мигрирана база;
- проблем в миграция блокира старта на API.

## 6.3 Backend entrypoint

Файл: [backend/app/main.py](backend/app/main.py)

Този файл:

- създава FastAPI app;
- добавя CORS middleware;
- регистрира всички routers;
- expose-ва root route `/`.

Конфигурацията идва от:

Файл: [backend/app/config.py](backend/app/config.py)

Основни env променливи:

- `DATABASE_URL`
- `JWT_SECRET`
- `JWT_ALGORITHM`
- `JWT_ACCESS_TOKEN_EXPIRES_MINUTES`
- `JWT_REFRESH_TOKEN_EXPIRES_MINUTES`
- `FRONTEND_BASE_URL`
- `CORS_ALLOWED_ORIGINS`
- `CORS_ALLOWED_ORIGIN_REGEX`
- SMTP параметри за password reset

## 6.4 Backend dependency graph

Стандартният слой е:

`routers -> services -> models/database`

Помощни модули:

- `app/core/`: auth, permissions, data visibility, dependencies
- `app/schemas/`: request/response DTO слоеве
- `app/templates/`: HTML шаблони и PDF логика
- `app/utils/`: import parsing

## 7. Backend API модули

## 7.1 Auth и bootstrap

Основни endpoints:

- `/auth/login`
- `/auth/refresh`
- `/auth/me`
- `/auth/me/change-password`
- `/auth/password-reset/request`
- `/auth/password-reset/confirm`
- `/auth/bootstrap-status`
- `/auth/bootstrap-superuser`

Ключова логика:

- първоначалният superuser може да се създаде само ако броят на users е 0;
- frontend проверява `initial_setup_required` и ако е `true`, показва initial setup екран.

Файлове:

- [backend/app/routers/auth.py](backend/app/routers/auth.py)
- [backend/app/routers/bootstrap.py](backend/app/routers/bootstrap.py)

## 7.2 Users, роли и permissions

Основни endpoints:

- `/users`
- `/users/permissions-catalog`
- `/users/roles-catalog`
- `/users/roles`

Системата поддържа:

- coarse role поле в `users.role`;
- role templates в `role_templates`;
- explicit permissions в `user_permissions`.

System role templates:

- `administrator`
- `office`
- `technician`

Файлове:

- [backend/app/routers/users.py](backend/app/routers/users.py)
- [backend/app/core/permissions.py](backend/app/core/permissions.py)

## 7.3 Clients, sites и billing projects

Основни endpoints:

- `/clients`
- `/clients/{client_id}`
- `/clients/{client_id}/contacts`
- `/clients/{client_id}/sites`
- `/clients/{client_id}/billing-projects`
- `/clients/import/preview`
- `/clients/import/confirm`

Clients модулът включва:

- клиенти;
- контакти;
- sites/обекти;
- billing/service projects;
- import preview/confirm workflow.

## 7.4 Materials, warehouses и equipment

Основни endpoints:

- `/materials`
- `/materials/import/preview`
- `/materials/import/confirm`
- `/materials/bulk-margin-update`
- `/warehouses`
- `/material-usages`
- `/equipment`

Материалите и billing проектите вече имат operational/commercial visibility разделение. Това е критично за technician security модела.

## 7.5 Service requests

Основни endpoints:

- `/service-requests`
- `/service-requests/dashboard-summary`
- `/service-requests/{request_id}`
- `/service-requests/{request_id}/assignments`
- `/service-requests/{request_id}/status`
- `/service-requests/{request_id}/billing-project`
- `/service-assignments/{assignment_id}/accept`
- `/service-assignments/{assignment_id}/reject`
- `/work-logs`
- `/material-usages`
- `/equipment`
- `/service-protocols/{request_id}/preview`
- `/service-protocols/{request_id}/pdf`

Това е operational ядрото на платформата.

## 7.6 Notifications

Основни endpoints:

- `/notifications`
- `/notifications/{notification_id}/read`
- `/notifications/read-all`

Notifications са отделен домейн чрез `user_notifications`.

## 7.7 Mobile API

Mobile приложението стъпва върху същия FastAPI runtime чрез `/mobile` endpoints:

- `/mobile/requests/workboard`
- `/mobile/requests/{request_id}`
- `/mobile/sites/{site_id}`
- `/mobile/requests/{request_id}/accept`
- `/mobile/requests/{request_id}/reject`
- `/mobile/requests/{request_id}/start-work`
- `/mobile/requests/{request_id}/start-travel`
- `/mobile/requests/{request_id}/stop-travel`
- `/mobile/requests/{request_id}/work-logs`
- `/mobile/requests/{request_id}/material-usages`
- `/mobile/requests/{request_id}/equipment-assets`
- `/mobile/materials`
- `/mobile/warehouses`
- `/mobile/requests/{request_id}/signatures`
- `/mobile/requests/{request_id}/complete`

Файл: [backend/app/routers/mobile.py](backend/app/routers/mobile.py)

## 8. Backend service layer

Най-важните service файлове са:

- [backend/app/services/service_request_service.py](backend/app/services/service_request_service.py)
- [backend/app/services/service_protocol_service.py](backend/app/services/service_protocol_service.py)
- [backend/app/services/mobile_request_service.py](backend/app/services/mobile_request_service.py)
- [backend/app/services/offer_service.py](backend/app/services/offer_service.py)
- [backend/app/services/pdf_service.py](backend/app/services/pdf_service.py)
- [backend/app/services/email_service.py](backend/app/services/email_service.py)
- [backend/app/services/audit_service.py](backend/app/services/audit_service.py)

### 8.1 `ServiceRequestService`

Това е най-критичният backend модул. Той капсулира:

- lifecycle на заявките;
- заключване на затворени/анулирани заявки;
- видимост според permissions;
- сериализация на request list/detail изглед;
- assignment accept/reject flow;
- billing project snapshot логика;
- work log, travel log и material usage запис;
- equipment asset запис;
- dashboard summary;
- protocol preview entry point.

Ключови константи:

- `ALLOWED_STATUS_TRANSITIONS`
- `NON_ACTIVE_REQUEST_STATUSES`
- `LOCKED_REQUEST_STATUSES`

### 8.2 `ServiceProtocolService`

Този модул агрегира:

- work logs;
- material usages;
- technicians;
- signatures;
- времеви breakdown по категории.

Използва се за preview payload и PDF протокола.

### 8.3 `AuditService`

`AuditService.log_event()` записва бизнес събития в `audit_logs`.

Audit се използва при:

- login success/failure;
- приемане/отказ на assignment;
- промяна на статус;
- смяна на billing project;
- work log insert;
- travel log insert/update;
- material usage insert;
- equipment asset insert;
- delete на service request.

## 9. Permission и security модел

## 9.1 Authentication

Auth е JWT-based.

Основни компоненти:

- access token
- refresh token
- dependency `get_current_user`
- dependency `get_current_active_user`

Файлове:

- [backend/app/core/deps.py](backend/app/core/deps.py)
- [backend/app/core/security.py](backend/app/core/security.py)

## 9.2 Authorization

Authorization не е само по role. Реалният контрол е permission-based.

Примери за permissions:

- `offers.read_all`
- `offers.read_own`
- `offers.edit_all`
- `clients.manage`
- `materials.read_operational`
- `materials.read_commercial`
- `billing_projects.read_operational`
- `billing_projects.read_commercial`
- `service_requests.read_all`
- `service_requests.read_assigned`
- `service_requests.assign`
- `service_requests.accept`
- `work_logs.manage`
- `material_usages.manage`
- `equipment.manage`
- `settings.manage`
- `users.manage`

## 9.3 Data visibility

Отделен модул:

Файл: [backend/app/core/data_visibility.py](backend/app/core/data_visibility.py)

Той разделя:

- operational data;
- commercial data.

Това е особено важно за:

- materials;
- billing projects;
- technician достъп.

## 9.4 Offer-specific visibility

Offers имат собствен permission helper:

Файл: [backend/app/core/offer_permissions.py](backend/app/core/offer_permissions.py)

Основно правило:

- потребители с only-own права виждат собствените си чернови и всички non-draft оферти;
- draft оферта остава скрита за други non-admin/non-read-all потребители.

## 10. Домейн модел и база данни

Най-важните SQLAlchemy модели са в:

Файл: [backend/app/models](backend/app/models)

Основни домейн групи:

- User domain: `users`, `role_templates`, `user_permissions`, `user_notifications`
- Client domain: `clients`, `client_contacts`, `client_sites`, `client_billing_projects`
- Service domain: `service_requests`, `service_assignments`, `work_logs`, `service_travel_logs`, `material_usages`, `equipment_assets`, `warehouses`, `service_protocol_signatures`
- Commercial domain: `offers`, `offer_lines`, `offer_contacts`, `tags`, `offer_tags`, `offer_sequences`
- Governance domain: `audit_logs`, `company_settings`

Критични инварианти:

- `service_assignments` имат unique ограничение по `request_id + technician_user_id`;
- `client_sites` имат unique `site_code` в рамките на клиента;
- `user_permissions` имат unique `user_id + permission_code`;
- `service_requests` пазят snapshot на billing project данните;
- `material_usages.quantity >= 0`;
- `work_logs` пазят nonnegative minute breakdown полета.

## 11. Миграции

Миграциите са в:

Файл: [backend/alembic/versions](backend/alembic/versions)

Най-важните migration линии в текущия snapshot:

- service platform foundation;
- client billing projects;
- protocol signatures;
- notifications;
- roles and request locking;
- service travel logs.

## 12. Import pipeline

Import helper логиката е централизирана в:

Файл: [backend/app/utils/import_utils.py](backend/app/utils/import_utils.py)

Поддържани формати:

- CSV
- Excel `.xlsx`
- Excel `.xlsm`

Поддържан pattern:

1. upload preview
2. избор на редове
3. confirm import

Използва се поне за:

- clients import;
- materials import;
- equipment import.

## 13. Web frontend архитектура

Entry points:

- [frontend/src/main.tsx](frontend/src/main.tsx)
- [frontend/src/App.tsx](frontend/src/App.tsx)

Web app използва:

- `QueryClientProvider`
- custom `ThemeProvider`
- `AuthProvider`
- `BrowserRouter`
- lazy-loaded page modules

React Query default configuration:

- `staleTime: 30000`
- `retry: 1`

Основни web routes:

- `/`
- `/login`
- `/forgot-password`
- `/reset-password`
- `/service-requests`
- `/service-requests/new`
- `/service-requests/:id`
- `/offers`
- `/offers/:id`
- `/clients`
- `/clients/import`
- `/clients/:id`
- `/clients/:clientId/sites/:siteId`
- `/clients/:clientId/sites/:siteId/equipment/import`
- `/materials`
- `/materials/import`
- `/materials/:id`
- `/users`
- `/settings`
- `/pdf-template`

Ключови frontend файлове:

- [frontend/src/context/AuthContext.tsx](frontend/src/context/AuthContext.tsx)
- [frontend/src/components/Layout.tsx](frontend/src/components/Layout.tsx)
- [frontend/src/api/axios.ts](frontend/src/api/axios.ts)
- [frontend/src/i18n.ts](frontend/src/i18n.ts)
- [frontend/src/locales/bg.json](frontend/src/locales/bg.json)
- [frontend/src/locales/en.json](frontend/src/locales/en.json)

## 14. Mobile app архитектура

`mobile-app/` е отделен клиент, фокусиран върху техници и оперативна теренна работа.

Entry points:

- [mobile-app/src/main.tsx](mobile-app/src/main.tsx)
- [mobile-app/src/App.tsx](mobile-app/src/App.tsx)

Основни mobile екрани:

- login
- workboard
- request details
- clients
- client details
- site details
- materials
- notifications
- profile

Важни mobile файлове:

- [mobile-app/src/context/AuthContext.tsx](mobile-app/src/context/AuthContext.tsx)
- [mobile-app/src/api/axios.ts](mobile-app/src/api/axios.ts)
- [mobile-app/src/utils/offlineDrafts.ts](mobile-app/src/utils/offlineDrafts.ts)
- [mobile-app/src/utils/geolocation.ts](mobile-app/src/utils/geolocation.ts)
- [mobile-app/src/components/BarcodeScannerDialog.tsx](mobile-app/src/components/BarcodeScannerDialog.tsx)
- [mobile-app/capacitor.config.ts](mobile-app/capacitor.config.ts)

Ключови особености:

- отделни storage ключове за mobile auth;
- barcode scanning flow;
- offline drafts;
- travel/GPS помощни функции;
- web-first клиент, но готов за native packaging.

## 15. Основни бизнес потоци

### 15.1 Initial setup

1. frontend пита `/auth/bootstrap-status`
2. ако няма users, показва initial setup page
3. създава се първи admin чрез `/auth/bootstrap-superuser`

### 15.2 Service request lifecycle

Типичен поток:

1. заявка се създава
2. офис/админ я assign-ва
3. техник приема или отказва
4. при работа се записват work logs, travel logs и material usages
5. генерира се protocol preview/PDF
6. заявката се завършва и по-късно се затваря

Поддържани статуси:

- `NEW`
- `ASSIGNED`
- `PENDING_ACCEPTANCE`
- `ACCEPTED`
- `REJECTED_BY_TECHNICIAN`
- `IN_PROGRESS`
- `WAITING_PARTS`
- `WAITING_CLIENT`
- `COMPLETED`
- `CLOSED`
- `CANCELLED`

### 15.3 Work log time split

Work logs автоматично изчисляват:

- total minutes
- regular minutes
- overtime minutes
- weekend minutes
- holiday minutes

Правила:

- работният ден е 08:00-17:00;
- weekend логиката е отделна;
- `is_holiday_override` пренасочва всичко към holiday bucket;
- `time_to <= time_from` е невалидно.

### 15.4 Billing project snapshot

При service request системата не разчита само на live връзка към `ClientBillingProject`.

Тя пази snapshot:

- project reference
- service type
- payment mode

Това е критично, за да не се счупи историята при бъдещи редакции.

### 15.5 Protocol signatures

Сервизният протокол поддържа подписи с роли:

- `technician`
- `client`

Съхранява се:

- signer name;
- image data;
- optional stroke JSON;
- signed_by_user_id;
- device/ip metadata;
- active/invalidation state.

## 16. Нерuntime и supporting артефакти

- [HTTPS_SETUP.md](HTTPS_SETUP.md): инструкции за локален HTTPS.
- [export-caddy-root-cert.ps1](export-caddy-root-cert.ps1): export на локалния Caddy root cert.
- [work_process.md](work_process.md): оперативни правила и уточнения.
- [client.md](client.md): домейн контекст за клиента.

Важно:

- старият PyOffers repo вече е извън това repository;
- не трябва да се предполага, че промяна тук автоматично важи и за legacy вариант другаде;
- този проект вече се поддържа като самостоятелна кодова база.

## 17. Локално стартиране

## 17.1 Предпочитан начин

```bash
docker compose up --build
```

## 17.2 Backend без Docker

```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload
```

## 17.3 Frontend без Docker

```bash
cd frontend
npm install
npm run dev
```

## 17.4 Mobile app без Docker

```bash
cd mobile-app
npm install
npm run dev
```

## 18. Тестове и валидация

Backend unit tests са в:

Файл: [backend/tests](backend/tests)

Покритите области включват:

- permission normalization;
- offer permission rules;
- service request helper logic;
- service protocol aggregation;
- data visibility rules.

Важен извод:

- има полезни unit tests за критични правила;
- няма evidence за пълно end-to-end test покритие;
- при промени в service lifecycle, permissions, import или mobile API е нужно ръчно regression тестване.

## 19. Maintenance hotspots

Най-рисковите зони при промени са:

### 19.1 Permissions

- [backend/app/core/permissions.py](backend/app/core/permissions.py)
- [backend/app/core/data_visibility.py](backend/app/core/data_visibility.py)
- [backend/app/core/offer_permissions.py](backend/app/core/offer_permissions.py)
- [backend/app/routers/users.py](backend/app/routers/users.py)
- [frontend/src/components/Layout.tsx](frontend/src/components/Layout.tsx)

### 19.2 Service request workflow

- [backend/app/models/service_request.py](backend/app/models/service_request.py)
- [backend/app/models/service_assignment.py](backend/app/models/service_assignment.py)
- [backend/app/services/service_request_service.py](backend/app/services/service_request_service.py)
- [backend/app/routers/service_requests.py](backend/app/routers/service_requests.py)
- [backend/app/routers/service_assignments.py](backend/app/routers/service_assignments.py)
- [mobile-app/src/pages/Workboard.tsx](mobile-app/src/pages/Workboard.tsx)
- [mobile-app/src/pages/RequestDetails.tsx](mobile-app/src/pages/RequestDetails.tsx)

### 19.3 Billing projects и commercial visibility

- [backend/app/models/client_billing_project.py](backend/app/models/client_billing_project.py)
- [backend/app/routers/clients.py](backend/app/routers/clients.py)
- [backend/app/services/service_request_service.py](backend/app/services/service_request_service.py)
- [backend/app/core/data_visibility.py](backend/app/core/data_visibility.py)
- [frontend/src/pages/ClientDetails.tsx](frontend/src/pages/ClientDetails.tsx)

### 19.4 Materials, equipment и imports

- [backend/app/models/material.py](backend/app/models/material.py)
- [backend/app/models/material_usage.py](backend/app/models/material_usage.py)
- [backend/app/models/equipment_asset.py](backend/app/models/equipment_asset.py)
- [backend/app/routers/materials.py](backend/app/routers/materials.py)
- [backend/app/routers/material_usages.py](backend/app/routers/material_usages.py)
- [backend/app/routers/equipment.py](backend/app/routers/equipment.py)
- [backend/app/utils/import_utils.py](backend/app/utils/import_utils.py)
- [frontend/src/pages/EquipmentImport.tsx](frontend/src/pages/EquipmentImport.tsx)

### 19.5 PDF и templates

- [backend/app/templates/offer_template.html](backend/app/templates/offer_template.html)
- [backend/app/templates/service_protocol_template.html](backend/app/templates/service_protocol_template.html)
- [backend/app/services/pdf_service.py](backend/app/services/pdf_service.py)
- [frontend/src/pages/PdfTemplate.tsx](frontend/src/pages/PdfTemplate.tsx)

## 20. Препоръчителен workflow за AI агенти и нови програмисти

При нова задача е най-безопасно да се работи в този ред:

1. Потвърди, че задачата е за това standalone repo, а не за външния legacy PyOffers проект.
2. Провери дали промяната засяга permissions или data visibility.
3. Ако засяга service workflow, започни от `service_request_service.py`.
4. Ако засяга UI, провери едновременно route-а, page файла и navigation/permission helpers.
5. Ако засяга структурата на данни, провери и миграциите, и snapshot/invariant логиката.
6. Ако засяга mobile flow, не променяй само web клиента; провери и `/mobile` router + mobile pages.
7. При промяна на enum/status/permission codes синхронизирай всички засегнати слоеве: backend model, backend service/router, schema, frontend type/UI, mobile type/UI при нужда и tests.

## 21. Кратко заключение

Това repo е самостоятелна сервизна платформа, а не вложен workspace в друго приложение. То съдържа:

- активен backend;
- активен web frontend;
- отделен mobile клиент за техници;
- permission-aware и data-safe архитектура;
- смес от commercial и field-service процеси.

За бъдеща поддръжка най-важните правила са:

- това repository е основният продукт;
- service и commercial данните трябва да останат ясно разделени;
- permissions се enforce-ват backend-first;
- service request lifecycle и billing snapshot логиката са критични;
- всяка промяна в ключови enum-и, permissions или статуси изисква синхронизация между backend, web и mobile.
