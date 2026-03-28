You are Codex working inside the existing PyOffers / service platform repository.

Your mission is to create a dedicated technician mobile application module integrated with the existing backend and service workflow.

Important:
This is NOT a standalone unrelated app.
It must integrate cleanly with the existing system, backend, authentication, service requests, work logs, materials, warehouses, service protocols, signatures, and permissions.

==================================================
GOAL
==================================================

Build a technician-focused mobile application for phones and tablets that supports the real field workflow for HVAC / Refrigeration service technicians.

The app must be:
- mobile-first
- tablet-friendly
- optimized for fast field work
- secure
- operationally focused
- free of commercial pricing visibility

Use the existing platform as the base system.
Do not duplicate business logic unnecessarily.
Reuse backend entities and APIs where possible, and extend them where required.

==================================================
TECHNICAL DIRECTION
==================================================

Recommended implementation approach:
- frontend mobile app based on React + TypeScript
- use the current frontend ecosystem where practical
- package/wrap it with Capacitor for mobile device features
- support Android first
- keep future iOS compatibility in mind

Reason:
The app needs practical mobile capabilities such as:
- barcode scanning
- signature capture
- print/share protocol PDF
- deep links to phone dialer
- deep links to maps/navigation
- possibly camera/file attachment support later

Do NOT rewrite the entire backend.
Do NOT create a separate disconnected mobile backend.

==================================================
BUSINESS USERS
==================================================

Primary users:
- service technicians

Secondary possible users later:
- team leads / field supervisors

Technicians must have an operational app, not an administrative/commercial app.

==================================================
CRITICAL PERMISSION RULE
==================================================

Technicians must NOT see prices.

Technicians must NOT see:
- material cost
- material sell price
- margins
- labor rates
- transport rates
- total commercial value
- internal billing calculations
- commercial ERP pricing details

Technicians may see only operational data:
- request details
- client
- site
- address
- phone
- equipment
- activity type
- work logs
- materials by code/name/unit/quantity/warehouse
- protocol data without prices

Enforce this at backend/API level, not only in the frontend.

==================================================
MOBILE WORKFLOW TO IMPLEMENT
==================================================

1. Login / access
- secure login for technicians
- support the existing authentication flow, but adapt it safely for mobile use
- persist session appropriately
- if using Zero Trust / access gateway architecture, make the UX clean and understandable

2. My assigned requests
Technician must see:
- assigned requests
- pending acceptance
- accepted/in progress
- waiting parts
- completed but unsigned / unsigned protocol
- recently closed

List item should show:
- request number
- client
- site
- city
- priority
- status
- scheduled/received date
- brief problem summary

3. Request details
Technician must be able to open a request and see:
- request number
- client name
- site / branch
- address
- contact person
- phone number if available
- reported problem
- activity type
- assigned technicians
- equipment data if available
- linked billing/service project in operational form only (without commercial pricing details)

4. Accept / reject request
Technician must be able to:
- accept request
- reject request
- provide rejection reason
- transition request to in progress

5. On-site actions
Within a request, technician must be able to:
- add or update serviced equipment
- record work performed
- add work log entries
- add used materials
- choose warehouse for each material used
- create a new independent onsite request if another problem is found

6. Service protocol completion
Technician must be able to:
- preview protocol
- capture signatures on device screen
- print/share protocol PDF
- mark protocol ready

==================================================
MOBILE FEATURES THAT MUST EXIST
==================================================

A. Signature capture
Signature capture is mandatory.
Support:
- client signature on screen
- technician signature on screen

Store:
- rendered signature image
- if possible raw stroke/vector data
- signed_at
- signer name
- signer role
- request/protocol reference
- IP/device metadata
- optional geolocation if consent is given
- document hash / integrity metadata if signature workflow already exists or is added now

If a signed protocol is edited afterward, require re-signing or invalidate the signature.

B. Barcode scanning for materials
Material entry by barcode scanning is mandatory.

Requirements:
- add barcode scanner action in material usage flow
- support scanning with mobile camera
- after scan:
  - search material by barcode first
  - fallback to ERP code if needed
  - show candidate materials
- technician can confirm selected material
- then choose:
  - warehouse
  - quantity
  - optional notes

Do not expose pricing fields during this flow.

C. Address to navigation
If the request/site has an address, the app must provide a clear action:
- "Navigate"
- open mobile navigation/maps app using deep link
- support common mobile navigation targets where practical
- at minimum open a valid maps/navigation URL from the address or coordinates

D. Phone dialing
If a phone number exists for the contact/site/client, the app must provide:
- tap-to-call action
- open device dialer using tel: link

E. PDF print/share
The app must support:
- viewing protocol PDF
- share/export PDF
- print PDF through device/system print flow

Do NOT depend on fragile direct Bluetooth printer APIs as the primary print mechanism.
Use reliable mobile OS share/print flows.

==================================================
UI / UX REQUIREMENTS
==================================================

The technician app must be mobile-first.

Design requirements:
- excellent usability on phones
- also good usability on tablets
- large touch targets
- low cognitive load
- fast actions
- minimal typing where possible
- clear statuses and action buttons
- readable in outdoor/field conditions
- support Bulgarian UI text cleanly

Suggested navigation:
- Login
- My Requests
- Request Details
- Work Log
- Materials
- Equipment
- Protocol Preview / Signature / Print
- Onsite New Request

Suggested request detail quick actions:
- Accept
- Reject
- Start Work
- Call
- Navigate
- Add Work
- Add Material
- Add Equipment
- New Onsite Request
- Protocol

==================================================
OFFLINE / FIELD RESILIENCE
==================================================

Implement practical field resilience.

At minimum:
- detect network/API unavailability clearly
- allow local draft capture for:
  - work notes
  - work logs
  - materials usage drafts
  - signatures pending upload if feasible
- queue/sync pending actions when connection returns if safe to do so

If full offline sync is too large for this iteration, implement draft persistence first.

==================================================
BACKEND / API REQUIREMENTS
==================================================

Use or extend existing backend APIs.

Create/extend APIs for mobile needs:
- technician request list
- accept/reject assignment
- start/in-progress/completed transitions
- work log CRUD
- material usage CRUD
- barcode lookup endpoint
- equipment CRUD
- onsite independent request creation
- protocol preview data
- signature upload/capture metadata
- protocol PDF retrieval/share

Ensure backend returns technician-safe schemas without pricing leakage.

==================================================
SECURITY REQUIREMENTS
==================================================

Apply all relevant prior security recommendations.

1. No price leakage to technician APIs
2. Strong authorization checks at backend
3. Secure session handling for mobile use
4. Audit logging for:
   - accept/reject
   - status changes
   - work log changes
   - material usage changes
   - protocol signature events
   - PDF generation/share events if practical
5. Input validation for all mobile-submitted data
6. If geolocation is collected for signatures or visits:
   - make it consent-based
   - store responsibly
   - do not make GPS the sole identity proof

==================================================
DATA / DOMAIN REQUIREMENTS
==================================================

Use the existing master data model:
- Client
- ClientSite
- Billing / Service Projects
- Materials
- Warehouses
- Equipment
- Service Requests
- Work Logs
- Material Usages
- Service Protocols

Important:
The mobile app must consume the same canonical client/site/material data as the main system.

==================================================
BARCODE SCANNING DETAILS
==================================================

Implement practical barcode scanning flow.

Requirements:
- use device camera scanning
- support repeated scanning during one visit
- if multiple matches exist, show compact selection list
- if no match exists:
  - allow manual search by code/name
  - optionally allow temporary unmatched scan note
- after successful material selection:
  - warehouse selection is required
  - quantity is required
  - technician can add note

==================================================
PROTOCOL REQUIREMENTS
==================================================

The service protocol in the mobile app must support:
- preview in mobile-friendly layout
- PDF generation
- technician signature
- client signature
- print/share action
- no prices visible to technicians or clients

The protocol must include:
- client
- site
- reason for visit
- repair type
- execution date
- worked time from/to
- technicians
- totals by time categories
- work description
- materials used with quantity and warehouse

==================================================
MAP / PHONE ACTION REQUIREMENTS
==================================================

If address exists:
- render a visible "Navigate" action
- generate mobile navigation link from address and/or coordinates

If phone exists:
- render a visible "Call" action
- use dialer-friendly link handling

If both exist:
- show both as top-level quick actions in request details

==================================================
IMPLEMENTATION STRATEGY
==================================================

Follow this order:

Phase 1:
- inspect the existing repository and service module state
- identify reusable auth, API, and data patterns
- propose a concise mobile architecture plan
- choose the cleanest place for the technician app inside the repo

Phase 2:
- create the technician mobile app structure
- implement authentication and session flow
- implement assigned requests list and request details
- add call and navigation quick actions

Phase 3:
- implement accept/reject/start-work transitions
- implement work log screens
- implement equipment screen
- implement material usage flow with barcode scanning

Phase 4:
- implement protocol preview
- implement signature capture
- implement PDF print/share flow

Phase 5:
- harden permissions and API responses
- add audit logging hooks
- test on mobile screen sizes
- fix usability issues
- summarize remaining gaps and next steps

==================================================
NON-GOALS FOR THIS ITERATION
==================================================

Do NOT spend major time on:
- full warehouse stock accounting
- ERP synchronization engine
- advanced analytics
- payroll calculations
- advanced reporting exports
- checklist engine
- complete offline sync engine
unless required for the mobile MVP architecture.

==================================================
QUALITY REQUIREMENTS
==================================================

- code and comments in English
- UI text may be Bulgarian where appropriate
- keep changes modular
- do not break the existing web frontend
- do not break the existing offers module
- do not duplicate business logic across multiple places
- prefer reusable service-layer/backend logic
- add tests where practical, especially for mobile-related backend workflows

==================================================
FINAL OUTPUT REQUIREMENTS
==================================================

At the end of implementation provide:
1. architecture summary
2. mobile app structure summary
3. security changes summary
4. barcode scanning implementation summary
5. signature implementation summary
6. print/share PDF implementation summary
7. remaining limitations
8. what still requires manual environment/device setup

Now begin by:
- analyzing the existing repository
- identifying where the technician mobile app should live
- proposing the file-by-file implementation plan
- then implementing it incrementally

Technician request list UI requirements:
- assigned-to-me requests must be pinned at the top
- assigned-to-me requests must have distinct visual highlighting
- unassigned requests must be clearly marked as available to accept
- requests rejected by another technician should visibly indicate prior rejection history
- quick actions from list when practical:
  - Accept
  - Open
  - Start Travel
  - Navigate

  Assigned request reminders:
- when a request is assigned to a technician, reminder notifications must repeat at a configurable interval
- reminders stop once the technician accepts/rejects the request or the assignment changes
- design the reminder mechanism so it works first for in-app notifications and can later be extended to push notifications

==================================================
DISPATCH / TECHNICIAN WORKFLOW уточнения
==================================================

Important workflow clarification:

1. Technician visibility of requests
Technicians must be able to see all service requests, not only the ones explicitly assigned to them.

However, request visibility must be clearly prioritized in the UI:
- requests assigned to the current technician must appear at the top
- these assigned requests must be visually highlighted with a distinct color/state
- unassigned requests must also be visible below
- requests assigned to other technicians may be visible, but with clear status indication and without allowing invalid takeover unless allowed by business rules

Implement technician request list grouping/priority like this:
1. Assigned to me (highest priority, highlighted)
2. Unassigned / available to accept
3. Other visible requests (lower emphasis)

2. Self-accepting unassigned requests
A technician must be able to accept/self-claim an unassigned request.
This is required for cases where a request is already entered into the system but has not yet been formally assigned.

When a technician self-claims an unassigned request:
- create an assignment record
- mark the request as accepted/assigned appropriately
- record who accepted it and when
- audit log the event

3. Notifications
Technicians must receive notifications for new requests.

Notification behavior:
- for newly visible / newly created requests: send notification
- for requests assigned to a technician: send repeated reminder notifications at configurable intervals until:
  - the request is accepted
  - the request is rejected
  - the request is reassigned
  - the request is cancelled/closed

Design this in a way that supports:
- in-app notifications first
- future push notifications later
- configurable reminder interval

4. Multiple technician assignment and rejection fallback
If more than one technician is assigned to a request and the first assigned technician rejects it:
- the request must remain visibly marked as rejected by that technician
- the rejection must be stored in assignment history
- the request should automatically continue to the next assigned technician in the assignment order
- the system must clearly show that the earlier technician rejected it
- audit log this transition

Do NOT lose rejection history.
Do NOT silently overwrite the first assignment state.

Suggested model:
- preserve assignment order / priority
- support primary and secondary technician assignments
- support sequential fallback logic

5. Client site coverage ownership
Each client site / branch must support a "Serviced by..." operational ownership model.

Implement both:
- service_region
- preferred_technician_ids

Reason:
Region alone is too broad.
Specific technicians alone are too rigid.
The system should support both operational planning models.

ClientSite / Branch should support fields like:
- service_region
- preferred_technician_ids
- optional backup_technician_ids

Technician profile should support fields like:
- home_region
- covered_regions

Use these fields for:
- assignment suggestions
- filtering
- dispatch logic
- future auto-assignment improvements

6. Travel time / travel tracking
Technicians must have the option to start a "Travel Time" timer when beginning travel to a request.

Requirements:
- start travel action
- stop/end travel action
- capture timestamps
- if GPS permission is granted, use GPS/location data to estimate distance traveled
- store travel duration and estimated distance
- allow manual correction/edit afterward for accuracy
- preserve both:
  - recorded automatic values
  - manually adjusted final values
- audit log manual changes

Suggested data model:
TravelLog / TravelEntry with fields such as:
- request_id
- technician_user_id
- travel_started_at
- travel_ended_at
- gps_start_lat
- gps_start_lng
- gps_end_lat
- gps_end_lng
- gps_distance_estimated
- travel_minutes_estimated
- travel_minutes_final
- distance_final
- manually_adjusted_by
- adjustment_reason

UI requirements:
- prominent "Start Travel" button
- prominent "Stop Travel" button
- show current timer while running
- after stop, allow review/edit before final save

Important:
GPS-based calculation is supporting evidence and operational automation, not the only source of truth.
Final travel time/distance must remain editable with proper audit logging.