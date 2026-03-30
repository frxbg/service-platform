# Service Platform

Самостоятелна сервизна платформа, отделена от legacy PyOffers кода и развивана като собствен GitHub проект.

Това repo съдържа активния продукт и вече не се третира като вложена част от по-голям mono-repo. Backend, web frontend и mobile app са в корена на проекта.

## Какво представлява

Репото комбинира в една система:

- сервизни заявки
- назначаване на техници
- work logs и сервизни дейности
- разход на материали и складове
- клиенти, обекти и проекти за фактуриране и сервиз
- equipment / asset записи към заявки
- сервизни протоколи с preview и PDF export
- оферти и offer statuses като вторичен, но интегриран модул
- потребители, роли и granular permissions

Фокусът на платформата е върху заявките и оперативната работа по тях. Dashboard-ът и основните потоци са ориентирани към:

- нови заявки
- активни заявки
- спешни заявки
- неназначени заявки
- текущо изпълнение от техници

Офертите остават налични, но не са водещият център на системата.

## Защо е отделно

- оригиналният проект остава непокътнат
- legacy PyOffers кодът може да се поддържа отделно
- активната разработка се случва директно в това repository
- backend, frontend и mobile app вече се намират в root структурата на проекта

## Основни модули

### 1. Service Requests

Поддържа:

- създаване на сервизна заявка
- списък и филтри
- детайлен екран
- статуси и lifecycle
- последваща заявка от обект
- assignment flow към техници
- accept / reject от техник

Основни backend точки:

- `/service-requests`
- `/service-assignments`
- `/work-logs`
- `/material-usages`
- `/equipment`
- `/service-protocols`

### 2. Клиенти и обекти

Поддържа:

- клиенти
- обекти / sites
- контакти
- legacy project number полета за съвместимост

### 3. Проекти за фактуриране и сервиз

Новата authoritative структура за ERP и сервизна обвързаност е `ClientBillingProject`.

Всеки проект за фактуриране и сервиз може да съдържа:

- client
- optional site
- ERP project reference
- service type
- payment mode
- validity
- default / active флагове
- notes
- pricing details, когато са разрешени по права

Сервизните заявки пазят snapshot на избрания проект, за да останат исторически коректни дори при последващи промени.

### 4. Материали и складове

Поддържа:

- материална номенклатура
- import
- material usage към заявка
- warehouse selection

Системата вече разделя operational и commercial видимостта на материалите.

### 5. Сервизен протокол

Поддържа:

- preview на база work logs и material usages
- PDF export
- technician-friendly протокол без ценообразуване

### 6. Оферти

Offers модулът е запазен и интегриран, но е secondary layer спрямо service модула. Използва се за:

- съществуващи търговски процеси
- статуси и видимост на оферти
- свързаност с clients и materials

## Permission модел

Платформата използва coarse роли за съвместимост:

- `admin`
- `user`

Реалната авторизация е на база explicit permissions.

Примери:

- `service_requests.read_all`
- `service_requests.read_assigned`
- `service_requests.create`
- `service_requests.assign`
- `service_requests.accept`
- `service_requests.reject`
- `service_requests.edit`
- `work_logs.manage`
- `material_usages.manage`
- `materials.read_operational`
- `materials.read_commercial`
- `billing_projects.read_operational`
- `billing_projects.read_commercial`
- `labor_rates.read`
- `transport_rates.read`
- `users.manage`
- `settings.manage`

## Важна business логика

### Service-first dashboard

Dashboard-ът е ориентиран към заявки, не към оферти. Показва основно:

- нови заявки
- активни заявки
- urgent заявки
- in-progress заявки
- неназначени заявки
- breakdown по статуси
- recent requests

### Разделяне на operational и commercial данни

Техниците не трябва да виждат търговска информация. Това е наложено на backend ниво, не само във frontend.

Technician-safe data:

- material code
- material name
- description
- quantity
- unit
- warehouse
- work logs
- service activity data

Скрити за техници commercial данни:

- material cost
- material sell price
- margin
- labor rates
- transport rates
- pricing defaults от billing projects
- contract pricing details
- total commercial values

## Текущо реализирани backend части

- permission layer
- granular permission catalog
- service request domain модели
- service assignments
- work logs
- material usages
- warehouses
- equipment assets
- client billing projects
- dashboard summary endpoint
- service protocol preview
- service protocol PDF export
- audit logging за ключови промени
- permission-aware exposure за clients, materials и service requests

Основни backend директории:

- [backend/app/models](/c:/Users/User/Documents/Projects/service-platform/backend/app/models)
- [backend/app/routers](/c:/Users/User/Documents/Projects/service-platform/backend/app/routers)
- [backend/app/services](/c:/Users/User/Documents/Projects/service-platform/backend/app/services)
- [backend/alembic/versions](/c:/Users/User/Documents/Projects/service-platform/backend/alembic/versions)

## Текущо реализирани frontend части

- request-centric dashboard
- service request list
- create request flow
- request details
- assignment UI
- status change UI
- work log entry
- material usage entry
- follow-up request flow
- billing project management в client detail
- permission-aware navigation
- multilingual support за новите service екрани

Основни frontend директории:

- [frontend/src/pages](/c:/Users/User/Documents/Projects/service-platform/frontend/src/pages)
- [frontend/src/components](/c:/Users/User/Documents/Projects/service-platform/frontend/src/components)
- [frontend/src/context](/c:/Users/User/Documents/Projects/service-platform/frontend/src/context)
- [frontend/src/locales](/c:/Users/User/Documents/Projects/service-platform/frontend/src/locales)

## Docker старт

Проектът може да се стартира локално през Docker Compose.

### Команда

```bash
docker compose up --build
```

### Услуги

- frontend: `http://localhost:3000`
- mobile app: `http://localhost:3001`
- backend: `http://localhost:8000`
- swagger docs: `http://localhost:8000/docs`
- postgres: `localhost:5432`

### Какво прави compose

- стартира PostgreSQL
- стартира backend
- стартира frontend
- подава основните env стойности
- изпълнява `alembic upgrade head` при backend старт

### Полезни env файлове

- [backend/.env.example](/c:/Users/User/Documents/Projects/service-platform/backend/.env.example)
- [frontend/.env.example](/c:/Users/User/Documents/Projects/service-platform/frontend/.env.example)

## Локална разработка

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Тестове

Добавени са unit tests за:

- permission normalization
- offer permissions
- service request logic
- service protocol aggregation
- data visibility rules

Тестовете са в:

- [backend/tests](/c:/Users/User/Documents/Projects/service-platform/backend/tests)

Забележка:
в работната среда, в която беше изграждан модулът, не всички тестове успяха да бъдат изпълнени автоматично, така че е нужна локална валидация.

## Текущ статус

Към момента `service-platform` е работещ MVP с добра backend основа и request-centric frontend flow.

Готово:

- самостоятелно repository
- service domain foundation
- request dashboard
- request lifecycle
- technician workflow
- protocol preview/PDF
- client billing project normalization
- permission-aware UI/API
- multilanguage за новите service екрани
- backend защита срещу pricing leaks към technicians

Оставащо за доразвиване:

- по-пълна автоматична валидация и smoke tests
- допълнителен UI polish
- mobile приложение по спецификацията в [mobile_app.md](/c:/Users/User/Documents/Projects/service-platform/mobile_app.md)
- допълнително production hardening

## Полезни документи

- [IMPLEMENTATION_PLAN.md](/c:/Users/User/Documents/Projects/service-platform/IMPLEMENTATION_PLAN.md)
- [TICKET_PROMPT.md](/c:/Users/User/Documents/Projects/service-platform/TICKET_PROMPT.md)
- [client.md](/c:/Users/User/Documents/Projects/service-platform/client.md)
- [mobile_app.md](/c:/Users/User/Documents/Projects/service-platform/mobile_app.md)

## Структура

```text
.
|- backend/
|  |- alembic/
|  |- app/
|  |  |- core/
|  |  |- models/
|  |  |- routers/
|  |  |- schemas/
|  |  |- services/
|  |  |- templates/
|  |- tests/
|- frontend/
|  |- src/
|  |  |- api/
|  |  |- components/
|  |  |- context/
|  |  |- locales/
|  |  |- pages/
|  |  |- utils/
|- mobile-app/
|  |- src/
|  |  |- components/
|  |  |- context/
|  |  |- locales/
|  |  |- pages/
|  |  |- utils/
|- docker-compose.yml
|- README.md
|- IMPLEMENTATION_PLAN.md
|- client.md
|- mobile_app.md
|- TICKET_PROMPT.md
```
