USE i18n Everywere don`t hardcode text!!!!


# Service Platform Integration Plan

This repository is the standalone continuation of the service/ticketing platform that grew out of the PyOffers baseline.

## Why this is separate

- The original PyOffers project can stay untouched in its own repository/folder.
- All active ticketing/service work now happens directly in this repository.
- Existing Offers logic is treated as a baseline to reuse, not as the place where new service functionality should be reintroduced.

## Phase order

1. Backend foundation
   - permission layer
   - service/ticketing domain models
   - Alembic migration
   - lifecycle service layer
   - audit logging foundation
2. Backend APIs
   - service requests
   - assignments
   - work logs
   - material usages
   - warehouses
   - equipment
   - protocol preview/PDF
3. Frontend MVP
   - service request list
   - create request flow
   - assignment flow
   - technician details workflow
   - protocol preview/export
4. Hardening
   - CORS/env config
   - safer refresh flow
   - deployment cleanup
   - template safety controls
5. Verification
   - backend lifecycle and auth tests
   - smoke validation for PDF generation
   - regression check for offers flow

## Initial assumptions

- This repository is the working copy for the active service platform.
- The current `admin/user` role model remains for compatibility, while permissions become the real authorization layer.
- Office staff and technicians are differentiated by explicit permissions, not by overloading the existing coarse role enum.
- Work time categorization uses a practical MVP rule:
  - weekdays `08:00-17:00` -> regular
  - weekday time outside that window -> overtime
  - Saturday/Sunday -> weekend
  - holiday support stays override-ready until a holiday calendar is introduced

## Client Billing Project Normalization

- ERP "Project No" is no longer treated as authoritative master data on `Client`.
- The normalized source of truth is `ClientBillingProject`, linked to:
  - `client_id`
  - optional `site_id`
  - ERP project reference
  - service type
  - payment mode
  - rates, validity, default flag, active flag
- Service requests now persist:
  - `billing_project_id`
  - `project_reference_snapshot`
  - `service_type_snapshot`
  - `payment_mode_snapshot`
- Billing project reassignment after request creation is supported and must stay auditable with old/new values and reason.
- Legacy `project_number` fields remain temporarily for compatibility with older offers/import flows, but new request workflows should prefer `ClientBillingProject`.

## Current Status

- Backend model, schema, router, migration, and request audit support for `ClientBillingProject` are in place.
- Request create/details flows now require and expose billing project selection and billing snapshot data.
- Client details UI now supports creating and editing billing projects.
- Remaining cleanup is mostly legacy-focused:
  - reduce visual dependence on old `project_number` fields in older client/offer flows
  - add stronger automated validation once local test/runtime execution is available

## Work Process Alignment

Based on `work_process.md`, the next correction wave focuses on four operational gaps:

1. Technician notification after assignment
   - add in-app notification records on assignment
   - expose a notification list and unread counters
   - keep the implementation backend-driven, not only UI-driven

2. Independent onsite request creation
   - onsite-discovered work should be creatable as a new request without forced parent linkage
   - optional traceability may remain available later, but the default process should not chain the new request automatically

3. Equipment capture on site
   - technicians must be able to describe real equipment directly from the active request workflow
   - this should work from mobile, not only from office/admin screens

4. Intake flow should stay lightweight
   - billing project selection should be optional during first intake
   - the request must still be valid with only client, site, problem, date/time, and responsible person
   - billing/service linkage can be refined afterward
