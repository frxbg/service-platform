
Important business clarification about "Project №":

"Project №" is an ERP project number and must NOT be modeled as a simple field directly on the Client entity.

Reason:
- the ERP project number may change every year
- the ERP project number is linked to contract/payment logic
- the same client may have different ERP project numbers depending on activity type
- a request may initially be created under one ERP project and later reassigned to another one
  for example:
  - initially created as paid service
  - later determined to be warranty
  - the ERP project number must then be changed

Therefore implement a separate entity for client-linked billing/service project profiles.

Create a normalized model such as:
Client
ClientSite
ClientBillingProject (or ClientServiceProject / ContractProfile)

ClientBillingProject fields should include at minimum:
- id
- client_id
- site_id (nullable, if the project applies to the whole client)
- project_reference          ← ERP project number, e.g. M26000013
- project_year
- service_type               ← paid_service / warranty / maintenance / installation / subscription / other
- payment_mode               ← paid / warranty / contract / internal / other
- description
- regular_labor_rate
- transport_rate
- valid_from
- valid_to
- is_default
- is_active
- notes

Service request requirements:
- a service request must reference:
  - client_id
  - site_id
  - billing_project_id
- the request must also store snapshot values such as:
  - project_reference_snapshot
  - service_type_snapshot
  - payment_mode_snapshot
so historical requests and generated protocols remain correct even if master data changes later

Workflow requirement:
- it must be possible to change the billing project after request creation
- example:
  - initially marked as paid service
  - later determined to be warranty
  - billing project is changed accordingly
- every such change must be auditable with:
  - old value
  - new value
  - changed by
  - changed at
  - reason for change

UI requirement:
- when creating a request, after selecting client and site, the user must be able to choose from the available billing/service projects for that client/site
- the system may suggest a default billing project based on service type, but the user must be able to change it