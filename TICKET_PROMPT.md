You are Codex working inside the repository `service-platform`.

Read and respect the following architecture rule first:

IMPORTANT:
- This repository is the active and primary product.
- Root-level `backend/`, `frontend/`, and `mobile-app/` are the live application code.
- Legacy PyOffers code may exist elsewhere, but it is not part of this repository layout.
- Do not reintroduce assumptions about an outer mono-repo or nested `service-platform/` folder.

You have been given a technical repository description and prior business clarifications.
Use them as the source of truth for architecture and workflow.

==================================================
PRIMARY MISSION
==================================================

Continue the active Service Platform product by implementing and refining the technician mobile workflow and related backend support, with strong attention to:

1. offline-capable technician workflow
2. equipment/assets list and selection by client site
3. barcode-based material entry
4. protocol completion, signatures, PDF preview, print/share
5. notifications and dispatch behavior
6. technician-safe data visibility (no commercial pricing exposure)
7. data safety, backup/export readiness, and auditability

Preserve the current architecture and do not break:
- service request lifecycle logic
- billing project snapshot logic
- permission model
- existing offers module
- existing web app unless necessary
- existing mobile app structure unless refactor is justified

==================================================
REPOSITORY / ARCHITECTURE CONTEXT
==================================================

The active product lives in:

- `backend/`
- `frontend/`
- `mobile-app/`

The active backend is FastAPI + SQLAlchemy + Alembic + PostgreSQL.
The active web frontend is React + TypeScript + Vite + MUI.
The active mobile app is React + TypeScript + Capacitor-based, web-first but ready for native packaging.

The active service platform already contains:
- service requests
- assignments
- work logs
- material usages
- equipment assets
- warehouses
- billing/service projects
- service protocol preview/PDF/signatures
- notifications
- permission-aware security model
- separate mobile endpoints and mobile app

Use the active repository code as the implementation base.

==================================================
CORE IMPLEMENTATION GOALS
==================================================

Implement/refine the technician mobile experience and backend support for the following.

--------------------------------------------------
A. TECHNICIAN REQUEST VISIBILITY / DISPATCH FLOW
--------------------------------------------------

Technicians must be able to see all service requests, not only those assigned to them.

However, the request list priority/order must be:

1. requests assigned to the current technician
2. unassigned requests available to accept/self-claim
3. other visible requests

Assigned-to-me requests must:
- appear at the top
- be visually highlighted with a distinct color/state

Technicians must be able to:
- accept assigned requests
- reject assigned requests with reason
- self-accept / self-claim an unassigned request

If multiple technicians are assigned and the first assigned technician rejects:
- preserve rejection history
- clearly show the request was rejected by that technician
- automatically continue assignment flow to the next technician in order
- do not lose prior assignment state
- audit log the event chain

--------------------------------------------------
B. NOTIFICATIONS
--------------------------------------------------

Technicians must receive notifications for new requests.

Implement:
- in-app notifications first
- architecture ready for future push notifications

Behavior:
- notify for newly created/newly visible requests
- for assigned requests, reminder notifications must repeat at configurable intervals until:
  - request is accepted
  - request is rejected
  - assignment changes
  - request is cancelled/closed

Requests assigned to the current technician must be emphasized in the mobile UI.

--------------------------------------------------
C. MOBILE APP CAPABILITIES
--------------------------------------------------

The technician mobile app must be mobile-first and field-oriented.

It must work well on:
- phones
- tablets

Add or refine these capabilities:

1. request workboard
2. request detail screen
3. quick actions:
   - Accept
   - Reject
   - Start Work
   - Start Travel
   - Stop Travel
   - Navigate
   - Call
   - Add Work Log
   - Add Material
   - Scan Barcode
   - Equipment
   - Protocol
   - Sign
   - Print / Share PDF
   - New Onsite Request

Use large touch targets and low-friction flows.

--------------------------------------------------
D. OFFLINE SUPPORT
--------------------------------------------------

Offline capability is mandatory for technician workflow.

Implement a local draft + deferred sync model in the mobile app.

The technician must be able to continue working without network and store locally:
- request snapshot
- client/site snapshot
- equipment snapshot
- work logs
- materials usage drafts
- protocol draft
- signatures
- protocol rendering input
- optional generated local PDF

At minimum support local states:
- local_draft
- pending_sync
- synced
- sync_failed

Requirements:
- technicians can continue filling protocol data without network
- technicians can store signatures locally
- technicians can add materials and work logs locally
- when connectivity returns, pending records can be synchronized safely
- preserve auditability of offline-created data

If practical, support local protocol PDF generation using local template and local draft data.

If full sync engine is too large for this pass, implement:
1. reliable local draft persistence
2. clear sync status
3. safe manual sync/retry

--------------------------------------------------
E. SERVICE EQUIPMENT / ASSETS BY SITE
--------------------------------------------------

Equipment/assets by client site are critical and must be implemented as first-class domain objects.

Use the existing `equipment_assets` domain and improve it where needed.

Goals:
- every client site can have a list of service equipment/assets
- technicians can browse/search/select equipment when working on a request
- technicians can add missing equipment on site
- requests can reference the actual serviced equipment
- service history can later be anchored around equipment

Modeling requirements:
- one asset = one real serviced equipment item
- keep normalized canonical fields plus flexible extra attributes
- allow grouping into systems if useful

Equipment list UI must support:
- list all assets for a site
- search by:
  - equipment type
  - manufacturer
  - model
  - serial number
  - asset code
  - description
- select one primary serviced asset
- optionally link multiple related assets
- create missing asset from mobile request detail screen

Import strategy:
- support equipment import through importer profiles / mapping logic
- tolerate heterogeneous Excel structures
- support one-row-to-many-assets import patterns where needed
- preserve client/site linkage

Add or refine fields such as:
- equipment_category
- equipment_type
- manufacturer
- model
- serial_number
- refrigerant_type
- refrigerant_charge_kg
- monitoring_position
- location_within_site
- served_area_or_purpose
- warranty_from
- warranty_to
- notes
- extra_attributes_json

--------------------------------------------------
F. SITE OWNERSHIP / REGION / TECHNICIAN COVERAGE
--------------------------------------------------

For client sites / branches, implement operational ownership fields.

Each site should support:
- service_region
- preferred_technician_ids
- optional backup_technician_ids

Each technician should support:
- home_region
- covered_regions

Use these for:
- dispatch suggestions
- filtering
- future auto-assignment
- displaying “serviced by...” at site level

Choose the best implementation approach based on the current codebase, but support both region logic and specific technician preference logic.

--------------------------------------------------
G. TRAVEL TIMER / GPS
--------------------------------------------------

Technicians must be able to track “Travel Time”.

Implement:
- Start Travel
- Stop Travel

Requirements:
- store travel start timestamp
- store travel end timestamp
- if GPS/location permission is granted, capture location data and estimate distance
- preserve estimated travel time and estimated distance
- allow later manual correction/edit for precision
- preserve both automatic and final values
- audit log manual adjustments

Suggested concepts:
- travel log / travel entry linked to request and technician

The UI must show:
- current running timer if travel is active
- review/edit step after stop
- clear indication whether values are GPS-estimated or manually adjusted

GPS is supporting operational evidence and automation, not the sole source of truth.

--------------------------------------------------
H. BARCODE SCANNING FOR MATERIALS
--------------------------------------------------

Barcode-based material entry is mandatory.

Implement camera-based scanning in the mobile app.

Flow:
1. technician opens Add Material / Scan Barcode
2. scan via camera
3. lookup by barcode first
4. fallback to ERP code/manual search if needed
5. choose material
6. choose warehouse
7. enter quantity
8. optionally add note
9. save usage

Requirements:
- repeated scanning in one visit must be fast
- if multiple matches exist, show compact candidate list
- if no match exists, allow manual fallback
- prices must never be shown to technicians during this flow

--------------------------------------------------
I. NAVIGATION AND PHONE LINKS
--------------------------------------------------

If a request/site has an address:
- show a prominent Navigate action
- open mobile navigation/maps app using deep link
- support address-based or coordinates-based navigation

If a phone number exists:
- show a prominent Call action
- use dialer-friendly `tel:` handling

These actions must be visible in request detail and easy to use in the field.

--------------------------------------------------
J. SERVICE PROTOCOL / SIGNATURE / PDF / PRINT
--------------------------------------------------

Protocol completion is a core technician flow.

The mobile app must support:
- protocol preview
- protocol signatures
- protocol PDF generation or retrieval
- print/share PDF
- no pricing visible in technician/client protocol view

Signature capture requirements:
- technician signature on screen
- client signature on screen
- store signature image
- if practical, store stroke/vector data
- store signed_at, signer_name, signer_role
- store device/IP metadata where available
- optional location data only if consent is given
- preserve auditability and invalidation logic if document changes after signing

Important:
Do NOT treat image alone as complete proof.
Keep layered signature evidence:
- visible signature
- audit metadata
- integrity / hash readiness

Printing requirement:
- support reliable PDF print/share through OS/browser/app share flows
- do not depend on fragile direct Bluetooth printer integrations as the primary mechanism
- direct Bluetooth printing may be explored later, but PDF-first print/share is the required baseline

--------------------------------------------------
K. NO PRICE VISIBILITY FOR TECHNICIANS
--------------------------------------------------

Critical rule:
Technicians must not see any commercial pricing information.

Technicians may see only operational data such as:
- material code
- material name
- description
- quantity
- unit
- warehouse
- request/site/equipment/workflow data

Technicians must NOT see:
- material cost
- material sell price
- margin
- labor rates
- transport rates
- total commercial value
- pricing defaults from billing projects
- internal ERP pricing details

Enforce this at backend/API level.
Do not rely only on frontend hiding.

If necessary, add/refine technician-safe schemas/responses.

--------------------------------------------------
L. BACKUP / EXPORT / DATA PROTECTION READINESS
--------------------------------------------------

Add data protection readiness.

Implement or prepare:
- periodic PostgreSQL backup strategy
- retention-ready backup workflow
- JSON export of core business data for disaster recovery / portability

At minimum, support or prepare exports for:
- service requests
- assignments
- work logs
- material usages
- equipment assets
- client/site master data
- service protocol metadata
- signature metadata

Also:
- log backup/export jobs
- preserve restore-readiness considerations
- prepare for future encrypted backup storage

This does not need to become a full infrastructure platform in this pass, but the codebase and docs should be ready for it.

==================================================
SECURITY / AUTHORIZATION / DATA RULES
==================================================

Respect and preserve the current permission-based architecture.

Do not bypass:
- backend authorization
- data visibility helpers
- technician vs commercial access split

Backend-first enforcement is required.

When implementing changes, review:
- permissions
- data visibility
- service workflow invariants
- mobile endpoints
- audit logging

Preserve:
- billing project snapshot logic
- locked request behavior
- audit trails
- unique constraints and service request invariants

==================================================
IMPLEMENTATION TARGETS
==================================================

Focus primarily on these active paths:

Backend:
- `backend/app/models/`
- `backend/app/routers/`
- `backend/app/services/`
- `backend/app/core/`
- `backend/app/schemas/`
- `backend/alembic/versions/`

Mobile app:
- `mobile-app/src/pages/`
- `mobile-app/src/components/`
- `mobile-app/src/context/`
- `mobile-app/src/api/`
- `mobile-app/src/types/`
- `mobile-app/src/utils/`

Web frontend only where needed:
- if admin/service management screens need support for equipment/region/ownership/notification config

==================================================
WORKFLOW FOR CODEX
==================================================

Follow this order:

Phase 1:
- inspect the current backend, frontend, and mobile app
- identify what already exists for:
  - mobile workboard
  - service requests
  - equipment assets
  - notifications
  - signatures
  - offline storage potential
- produce a concise implementation plan before major edits

Phase 2:
- refine/extend backend models, services, routers, and schemas where required
- add Alembic migrations only when necessary and keep them additive

Phase 3:
- implement/refine mobile request workboard prioritization and highlight logic
- implement technician accept/self-claim/reject flows
- implement notification/reminder backend/frontend flow
- implement equipment list and selection flow
- implement barcode scanning and material usage flow
- implement travel timer/GPS-assisted logging

Phase 4:
- implement or refine offline draft persistence and sync status handling
- implement signature capture and protocol PDF print/share flow
- ensure no price leakage in mobile API/UI

Phase 5:
- add/update tests for critical business logic
- run lint/tests/type checks where applicable
- summarize architecture changes, remaining gaps, and manual setup requirements

==================================================
TESTING REQUIREMENTS
==================================================

Add or update tests for critical logic, especially:
- technician request visibility ordering
- assigned highlighting data/state
- self-accept unassigned request flow
- multi-technician rejection fallback flow
- no-price visibility rules
- equipment selection and linkage
- travel timer / travel log validation
- offline draft state handling where backend logic applies
- barcode lookup endpoint behavior
- signature/protocol workflow smoke tests

==================================================
NON-GOALS FOR THIS PASS
==================================================

Do not spend major time on:
- full warehouse stock accounting
- deep ERP synchronization engine
- advanced analytics dashboards
- payroll/reporting calculations
- full push notification infrastructure
- complete customer portal
- direct Bluetooth printer integration as the primary print method

unless absolutely required to support the mobile MVP architecture.

==================================================
OUTPUT REQUIREMENTS
==================================================

At the end provide:
1. architecture summary
2. backend changes summary
3. mobile app changes summary
4. offline handling summary
5. equipment/assets implementation summary
6. notification/reminder summary
7. security/no-price-visibility summary
8. backup/export readiness summary
9. remaining limitations
10. what still needs manual environment/device setup

Now begin by:
- analyzing the existing active repository code
- identifying which parts already exist vs what must be added/refined
- proposing a file-by-file implementation plan
- then implementing incrementally
