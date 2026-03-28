# Service Platform Integration Plan

This workspace is intentionally isolated from the current PyOffers codebase.

## Why this is separate

- The original project folder stays untouched so it can continue to map cleanly to the current GitHub project.
- All ticketing/service work starts in `service-platform/` and can later be published to a separate repository.
- Existing Offers logic is treated as a baseline to reuse, not as the place where the new module is developed directly.

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

- `service-platform/` is the new working copy for this ticket.
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
