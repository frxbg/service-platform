You are Codex working inside the repository for PyOffers.

Your mission is to evolve the current project into a production-oriented internal platform for HVAC/Refrigeration operations by adding a new Service / Ticketing module on top of the existing system, while also improving architecture, authorization, and security hardening across the application.

Work carefully, incrementally, and keep the existing Offers functionality operational.

==================================================
PRODUCT CONTEXT
==================================================

Current project:
- Backend: FastAPI + SQLAlchemy + Alembic + PostgreSQL
- Frontend: React + TypeScript + Vite + Material UI
- Existing modules: auth, users, clients, materials, offers, settings, PDF generation
- Existing useful domains already present:
  - users
  - clients
  - client contacts
  - client sites / branches
  - materials
  - PDF template infrastructure

The existing Offers module must remain intact and continue to work.
Do NOT merge service tickets into the offers model.
Service requests and offers are separate business objects.

==================================================
HIGH-LEVEL GOAL
==================================================

Transform the system into a modular platform with:
1. existing Offers module preserved
2. new Service Requests / Ticketing module added
3. security and authorization improvements applied
4. better deployment readiness
5. ability to generate service protocol PDFs

Focus first on the core workflow only.
Do not spend time on advanced exports, BI dashboards, checklist engines, or nonessential polish unless needed for the MVP.

==================================================
REAL BUSINESS WORKFLOW TO IMPLEMENT
==================================================

Implement the following real operational flow:

I. From incoming request to execution

1. Request intake
A request can arrive by external request number, phone, email, etc.
The administrator creates a new service request with:
- client
- site / branch number or name, e.g. "LIDL 102" or "KFC Stamboliyski"
- problem description
- date received
- time received

The logged-in user who creates the request should automatically become the responsible person by default, with ability to change it.

2. Technician assignment and priority
After registration, the request is assigned to one or more technicians and a priority is set:
- low
- standard
- high
- urgent

At assignment stage there is no warehouse selection yet because the office often does not know whether parts will be needed.

3. Technician notification
The assigned technician must be notified about the new service task.
For now implement this as in-app visibility and backend-ready notification hooks.
Do not overengineer email/SMS push infrastructure in the first phase.

4. Technician acceptance / rejection
The assigned technician must be able to:
- accept the request
- reject the request
- optionally provide a rejection reason

5. On-site equipment description
At the site, the technician must be able to describe the actual serviced equipment because the customer-provided information is not always accurate.

6. Work performed description
The technician records the actual work performed and the actual time spent.

7. Materials and warehouse
The technician records materials used by code and must specify the warehouse from which each item was taken.
A technician may consume materials from different warehouses, not only “their own” warehouse.

Important:
Multiple technicians may work on the same request.
The time of each technician must be stored separately and must appear in the service protocol.
Example:
2 technicians × 2 hours during working time = 4 hours labor total.

II. Service protocol content

The service protocol must clearly contain:
1. customer and serviced site
2. reason for visit
3. type of repair
4. execution date
5. worked time from / to
6. participating technicians by name
7. total worked time split by:
   - regular working time
   - overtime
   - weekend
   - holiday
8. detailed description of work performed
9. materials / spare parts used with quantity and warehouse

III. Self-assigned on-site activity
A technician must be able to create a new independent request while already on site.
Example:
- technician goes for issue A, discovers issue B on another unit
- technician creates a new service request on site
- the new request is separate from the original one
- optionally store a reference like “discovered during request X”, but it must remain an independent request

Focus only on these core functions for now.

==================================================
ARCHITECTURAL REQUIREMENTS
==================================================

Preserve existing modules and add new modules cleanly.

Add the following backend domains:

1. service_requests
Core ticket / request entity

2. service_assignments
Assignment records, acceptance/rejection, history

3. work_logs
Time entries per technician

4. material_usages
Materials used per request with warehouse

5. warehouses
Warehouse master data

6. equipment_assets
Equipment / serviced asset records linked to client and site

7. service_protocols
PDF generation and protocol view model

Do not collapse these into one table.
Use normalized relational design.

==================================================
DATA MODEL REQUIREMENTS
==================================================

Design proper SQLAlchemy models and Alembic migrations.

Suggested models:

A. ServiceRequest
Fields should include at minimum:
- id
- request_number
- external_order_number (nullable)
- source (phone, email, external_number, onsite, other)
- client_id
- site_id
- responsible_user_id
- created_by_user_id
- reported_problem
- request_reason_code
- repair_type_code
- priority
- status
- reported_at
- created_at
- updated_at
- discovered_during_request_id (nullable)
- notes_internal
- notes_client

B. ServiceAssignment
- id
- request_id
- technician_user_id
- assigned_by_user_id
- assigned_at
- assignment_status (pending, accepted, rejected, cancelled)
- reject_reason
- accepted_at
- rejected_at
- is_primary

C. WorkLog
- id
- request_id
- technician_user_id
- work_date
- time_from
- time_to
- minutes_total
- minutes_regular
- minutes_overtime
- minutes_weekend
- minutes_holiday
- activity_description
- repair_type_code
- created_by_user_id
- created_at

D. Warehouse
- id
- code
- name
- responsible_user_id (nullable)
- is_active

E. MaterialUsage
- id
- request_id
- material_id
- warehouse_id
- technician_user_id
- quantity
- unit
- notes
- used_at

F. EquipmentAsset
- id
- client_id
- site_id
- equipment_type
- manufacturer
- model
- serial_number
- asset_tag
- location_note
- refrigerant
- notes
- is_active

G. Optional lookup tables or enums
- request priority
- request status
- request source
- work time category logic
- request reason catalog
- repair type catalog

==================================================
STATUS / WORKFLOW REQUIREMENTS
==================================================

Implement a clear request lifecycle.

Suggested statuses:
- NEW
- ASSIGNED
- PENDING_ACCEPTANCE
- ACCEPTED
- REJECTED_BY_TECHNICIAN
- IN_PROGRESS
- WAITING_PARTS
- WAITING_CLIENT
- COMPLETED
- CLOSED
- CANCELLED

Implement explicit transition logic in backend service layer.
Do not leave status transitions as unrestricted patch-anything behavior.

==================================================
PERMISSIONS / AUTHORIZATION REQUIREMENTS
==================================================

The current system has only coarse roles and needs improvement.

Implement a permission-oriented authorization layer.
Keep compatibility with current admin/user roles, but add granular permissions.

Suggested permissions:
- offers.read_all
- offers.read_own
- offers.edit_own
- offers.edit_all
- clients.read
- clients.manage
- materials.read
- materials.manage
- service_requests.read_all
- service_requests.read_assigned
- service_requests.create
- service_requests.assign
- service_requests.accept
- service_requests.reject
- service_requests.edit
- service_requests.close
- work_logs.manage
- material_usages.manage
- warehouses.manage
- equipment.manage
- settings.manage
- users.manage

At minimum:
- admins can do everything
- office/admin users can create and assign requests
- technicians can see assigned requests, accept/reject them, log work, log materials, create onsite requests
- technicians should not automatically gain unrestricted client/material/settings management

Centralize permission checks.
Do not duplicate ad hoc authorization logic across routers.

==================================================
SECURITY / HARDENING REQUIREMENTS
==================================================

Apply the following improvements in addition to the feature work.

1. CORS hardening
The backend currently behaves like a dev setup.
Replace permissive all-origins behavior with environment-based allowed origins.

2. Token/session hardening
Review current auth flow.
Reduce exposure of tokens.
Avoid weak refresh flow patterns.
Prefer a safer refresh strategy than the current simplistic approach.
If full cookie-based migration is too large for this iteration, at least:
- improve refresh handling
- avoid putting refresh tokens in query params
- add token rotation readiness
- make logout/session invalidation designable for future extension

3. Remove insecure bootstrap defaults
Do not rely on static admin credentials.
Refactor bootstrap/admin creation so production cannot accidentally depend on hardcoded credentials.

4. Deployment hardening
Prepare the app for production:
- remove dev-only reload behavior from production path
- separate dev and prod compose/runtime assumptions
- do not expose database ports unnecessarily in production examples
- do not copy .env files into the image unnecessarily
- make configuration environment-driven

5. Audit logging
Add audit logs for at least:
- login success/failure hooks if practical
- request creation
- assignment
- acceptance/rejection
- status changes
- work log creation/update
- material usage creation/update
- PDF protocol generation
- admin/security-relevant settings changes

6. Validation and integrity
Add proper validation for:
- request/site/client linkage
- warehouse/material linkage
- assignment duplication
- work log time ranges
- impossible negative values
- duplicate codes where applicable

7. Safe template handling
The app already uses HTML templates for PDFs.
Keep the current PDF strategy, but implement service protocol PDF generation in a controlled way.
Do not introduce arbitrary unsafe template execution paths for non-admin users.

==================================================
FRONTEND REQUIREMENTS
==================================================

Add a clean MVP UI using the existing frontend stack.

Implement at minimum:

1. Service request list page
- filters by status, priority, technician, client, site, date range
- search
- visible columns:
  - request number
  - client
  - site
  - priority
  - status
  - responsible person
  - assigned technician(s)
  - created/received date

2. Create service request page/dialog
Fields:
- client
- site
- problem description
- source
- external order number
- request reason
- date/time received
- responsible person defaulted to current user
- priority

3. Assignment UI
- assign one or more technicians
- mark primary technician
- show assignment status

4. Technician request details page
- accept request
- reject request with reason
- start work / in progress
- add equipment
- add work logs
- add materials with warehouse
- create onsite follow-up request

5. Service protocol preview/export page
- display protocol data clearly
- export PDF

Use existing UI patterns where practical.
Do not overdesign.
Keep it production-readable and consistent.

==================================================
PDF / DOCUMENT REQUIREMENTS
==================================================

Add service protocol PDF generation using the current PDF infrastructure pattern.
Create a separate service protocol template, not mixed into offers template.

The service protocol PDF must include:
- client and site
- reason for visit
- repair type
- execution date
- from/to worked time
- technicians by name
- totals split by regular/overtime/weekend/holiday
- detailed work description
- materials with quantities and warehouse

Keep Bulgarian-friendly formatting and encoding in mind.

==================================================
BACKEND API REQUIREMENTS
==================================================

Create clean routers and schemas for:
- /service-requests
- /service-assignments
- /work-logs
- /material-usages
- /warehouses
- /equipment
- /service-protocols

Use service-layer logic where decisions are nontrivial.
Do not place all business rules directly inside routers.

==================================================
MIGRATION STRATEGY
==================================================

Use Alembic migrations.
Do not break existing offers/users/clients/materials data.
Prefer additive schema evolution.

If needed, add seed/bootstrap support for:
- default priorities
- default statuses
- optional initial warehouse records

==================================================
TESTING REQUIREMENTS
==================================================

Add meaningful automated tests, especially for:
- authorization rules
- request lifecycle transitions
- technician accept/reject flow
- multiple technicians time aggregation
- warehouse/material usage recording
- onsite independent request creation
- PDF/service protocol generation smoke test
- validation edge cases

If there is no test framework yet, add one.
Prefer backend tests first for the critical business rules.

==================================================
IMPLEMENTATION STRATEGY
==================================================

Follow this order:

Phase 1:
- inspect repository structure and existing patterns
- identify reusable models/components/services
- produce a concise implementation plan in comments or notes
- do not change code blindly

Phase 2:
- add new models and migrations
- add permissions foundation
- add backend service logic and routers
- add tests for core flows

Phase 3:
- add frontend screens/forms for MVP workflow
- integrate with API
- ensure existing offers flow still works

Phase 4:
- add service protocol PDF
- add audit logging
- apply security/config hardening

Phase 5:
- run tests / linters / type checks
- fix failures
- summarize completed work, remaining gaps, and follow-up recommendations

==================================================
NON-GOALS FOR THIS ITERATION
==================================================

Do NOT spend major time on:
- advanced analytics
- full notification infrastructure
- ERP integration
- stock quantity accounting engine
- preventive maintenance checklists
- payroll/reporting exports
- mobile app packaging
unless absolutely required for the MVP structure.

Important:
Warehouses must be implemented now as master data plus per-material usage source selection.
Do not implement full stock accounting in this iteration.
However, design the schema so that future stock movement, inventory balance, transfers, and ERP sync can be added without breaking existing service request data.

==================================================
OUTPUT REQUIREMENTS
==================================================

While working:
- inspect existing code first
- explain major decisions briefly in code comments or commit-style summaries
- keep changes modular
- avoid unnecessary rewrites
- preserve current offers functionality
- avoid breaking migrations
- avoid insecure shortcuts

At the end:
1. summarize architecture changes
2. summarize security improvements applied
3. list any remaining risks
4. list recommended next steps
5. show exactly what still needs manual configuration

Now begin by:
- analyzing the repository structure
- identifying the current auth, router, models, and PDF patterns
- proposing the concrete file-by-file implementation plan
- then implementing the solution incrementally