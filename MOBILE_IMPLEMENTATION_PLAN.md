# Mobile App Implementation Plan

This plan defines the first implementation phases for the technician mobile application inside `service-platform/`.

## Placement

The technician mobile application will live in:

- `service-platform/mobile-app/`

Reason:

- keeps the mobile app isolated from the existing web frontend
- allows reuse of the same backend and auth flow
- keeps Capacitor-specific setup out of the web app
- remains easy to package for Android first

## Architecture Direction

### Backend

Use the existing FastAPI backend and extend it with mobile-safe endpoints only where the mobile workflow needs different visibility or interaction patterns.

Initial backend additions:

- mobile-safe technician workboard endpoint
- mobile-safe request details endpoint
- self-claim endpoint for unassigned requests
- request ordering/grouping logic for technicians

Later backend phases:

- travel log model and endpoints
- notification/reminder state
- site ownership / regional coverage fields

### Frontend

Use a dedicated React + TypeScript mobile app prepared for Capacitor.

Initial mobile app scope:

- login
- persistent mobile session
- my workboard
- request details
- quick actions: call, navigate, open
- self-claim action for unassigned requests
- i18n-first UI with Bulgarian and English locale files

Later phases:

- work log screens
- material usage with barcode scanning
- equipment screen
- PDF share/print
- local draft persistence

## File-by-File Plan

### Backend

- `backend/app/schemas/mobile.py`
  - technician workboard schemas
  - mobile request detail schemas
  - self-claim request/response schemas

- `backend/app/services/mobile_request_service.py`
  - mobile-safe request list query
  - grouping and ranking logic
  - technician-safe detail serializer
  - self-claim logic

- `backend/app/routers/mobile.py`
  - `/mobile/requests/workboard`
  - `/mobile/requests/{request_id}`
  - `/mobile/requests/{request_id}/accept`
  - `/mobile/requests/{request_id}/signatures`
  - `/mobile/requests/{request_id}/complete`

- `backend/app/main.py`
  - register the mobile router

- `backend/tests/test_mobile_request_service.py`
  - ranking/grouping tests
  - self-claim behavior tests

### Mobile App

- `mobile-app/package.json`
- `mobile-app/tsconfig.json`
- `mobile-app/tsconfig.app.json`
- `mobile-app/tsconfig.node.json`
- `mobile-app/vite.config.ts`
- `mobile-app/index.html`
- `mobile-app/capacitor.config.ts`

- `mobile-app/src/main.tsx`
- `mobile-app/src/App.tsx`
- `mobile-app/src/theme.ts`
- `mobile-app/src/index.css`
- `mobile-app/src/i18n.ts`

- `mobile-app/src/api/axios.ts`
- `mobile-app/src/context/AuthContext.tsx`
- `mobile-app/src/utils/mobileLinks.ts`
- `mobile-app/src/utils/requestPresentation.ts`

- `mobile-app/src/types/mobile.ts`

- `mobile-app/src/locales/bg.json`
- `mobile-app/src/locales/en.json`

- `mobile-app/src/pages/Login.tsx`
- `mobile-app/src/pages/Workboard.tsx`
- `mobile-app/src/pages/RequestDetails.tsx`

- `mobile-app/src/components/MobileLayout.tsx`
- `mobile-app/src/components/RequestCard.tsx`
- `mobile-app/src/components/StatusPill.tsx`

## Implementation Order

1. Add backend mobile schemas and service
2. Add mobile router and self-claim endpoint
3. Create `mobile-app/` scaffold
4. Wire auth/session flow
5. Render workboard with grouped requests
6. Render request details with call/navigate quick actions
7. Keep all mobile UI strings inside i18n locale files only
8. Prepare next phase for travel, signatures, barcode scanning, and drafts
9. Complete request only after technician and client signatures are collected

## Current Implementation Snapshot

Implemented now:

- backend mobile workboard endpoint
- backend mobile request details endpoint
- backend accept/self-claim flow for technicians
- backend reject/start-work/work-log/material usage mobile endpoints
- backend operational lookup endpoints for materials and warehouses
- backend signature storage and completion endpoints for technician + client signatures
- dedicated `mobile-app/` scaffold for React + Vite + Capacitor
- dockerized `mobile-app` service in the main `docker-compose.yml`
- mobile auth context and token persistence
- i18n setup with Bulgarian and English locales
- first mobile screens:
  - login
  - requests center with filters and grouped workboard
  - request details
  - clients
  - client details
  - materials / warehouse
  - technician profile
- left-side mobile navigation shell with section menu and request badge
- quick actions:
  - open
  - accept
  - reject
  - start work
  - save technician signature
  - save client signature
  - complete request after required signatures
  - call
  - navigate
- request detail dialogs for:
  - reject reason
  - work log creation
  - material usage creation
- reject is blocked once work has already started
- signatures cannot be changed through mobile after the request is completed or closed
- request filters now cover:
  - my requests / all requests
  - status
  - client
  - city
  - site
- protocol section now shows collected signatures and readiness for completion

Still pending for next phases:

- work log CRUD expansion
- material usage flow polish
- barcode scanning
- equipment editing
- PDF share / print polish
- draft persistence / offline-safe flows
- notification and reminder mechanism
