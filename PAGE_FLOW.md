# Web Page Flow

This diagram maps the current Next.js web routes in `apps/web/src/app` and the main in-app paths between them. It focuses on the web app; the React Native mobile apps have separate screen flows.

## Screenshot Gallery

Captured from the local web app at a 1440 x 1200 desktop viewport. Workspace screenshots show the unauthenticated/default route state unless a local browser session is active.

### Public Discovery

| Page | Screenshot |
| --- | --- |
| `/` | [![Home page screenshot](docs/page-flow-screenshots/thumbs/home.png)](docs/page-flow-screenshots/home.png) |
| `/customer` | [![Customer search page screenshot](docs/page-flow-screenshots/thumbs/customer-search.png)](docs/page-flow-screenshots/customer-search.png) |
| `/customer/listings` | [![Customer listings page screenshot](docs/page-flow-screenshots/thumbs/customer-listings.png)](docs/page-flow-screenshots/customer-listings.png) |
| `/about` | [![About page screenshot](docs/page-flow-screenshots/thumbs/about.png)](docs/page-flow-screenshots/about.png) |

### Signup And Login

| Page | Screenshot |
| --- | --- |
| `/auth` | [![Auth role picker screenshot](docs/page-flow-screenshots/thumbs/auth.png)](docs/page-flow-screenshots/auth.png) |
| `/auth/customer` | [![Customer signup screenshot](docs/page-flow-screenshots/thumbs/auth-customer.png)](docs/page-flow-screenshots/auth-customer.png) |
| `/auth/provider/create` | [![Provider signup screenshot](docs/page-flow-screenshots/thumbs/auth-provider-create.png)](docs/page-flow-screenshots/auth-provider-create.png) |
| `/auth/crew` | [![Crew signup screenshot](docs/page-flow-screenshots/thumbs/auth-crew.png)](docs/page-flow-screenshots/auth-crew.png) |
| `/auth/complete` | [![Auth callback screenshot](docs/page-flow-screenshots/thumbs/auth-complete.png)](docs/page-flow-screenshots/auth-complete.png) |
| `/login` | [![Login role picker screenshot](docs/page-flow-screenshots/thumbs/login.png)](docs/page-flow-screenshots/login.png) |
| `/login/customer` | [![Customer login screenshot](docs/page-flow-screenshots/thumbs/login-customer.png)](docs/page-flow-screenshots/login-customer.png) |
| `/login/provider` | [![Provider login screenshot](docs/page-flow-screenshots/thumbs/login-provider.png)](docs/page-flow-screenshots/login-provider.png) |
| `/login/crew` | [![Crew login screenshot](docs/page-flow-screenshots/thumbs/login-crew.png)](docs/page-flow-screenshots/login-crew.png) |
| `/login/ops` | [![Ops login screenshot](docs/page-flow-screenshots/thumbs/login-ops.png)](docs/page-flow-screenshots/login-ops.png) |

### Role Workspaces

| Page | Screenshot |
| --- | --- |
| `/customer/dashboard` | [![Customer dashboard screenshot](docs/page-flow-screenshots/thumbs/customer-dashboard.png)](docs/page-flow-screenshots/customer-dashboard.png) |
| `/customer/history` | [![Customer history redirect screenshot](docs/page-flow-screenshots/thumbs/customer-history.png)](docs/page-flow-screenshots/customer-history.png) |
| `/provider` | [![Provider overview screenshot](docs/page-flow-screenshots/thumbs/provider.png)](docs/page-flow-screenshots/provider.png) |
| `/provider/management` | [![Provider management screenshot](docs/page-flow-screenshots/thumbs/provider-management.png)](docs/page-flow-screenshots/provider-management.png) |
| `/provider/payments` | [![Provider payments screenshot](docs/page-flow-screenshots/thumbs/provider-payments.png)](docs/page-flow-screenshots/provider-payments.png) |
| `/provider/partnerships` | [![Provider partnerships screenshot](docs/page-flow-screenshots/thumbs/provider-partnerships.png)](docs/page-flow-screenshots/provider-partnerships.png) |
| `/crew` | [![Crew dashboard screenshot](docs/page-flow-screenshots/thumbs/crew.png)](docs/page-flow-screenshots/crew.png) |
| `/crew/schedule` | [![Crew schedule screenshot](docs/page-flow-screenshots/thumbs/crew-schedule.png)](docs/page-flow-screenshots/crew-schedule.png) |
| `/crew/schedule/history` | [![Crew schedule history screenshot](docs/page-flow-screenshots/thumbs/crew-schedule-history.png)](docs/page-flow-screenshots/crew-schedule-history.png) |
| `/ops` | [![Ops dashboard screenshot](docs/page-flow-screenshots/thumbs/ops.png)](docs/page-flow-screenshots/ops.png) |

### Local And Service Pages

| Page | Screenshot |
| --- | --- |
| `/barnegat-nj` | [![Barnegat launch page screenshot](docs/page-flow-screenshots/thumbs/barnegat.png)](docs/page-flow-screenshots/barnegat.png) |
| `/barnegat-nj/lawn-mowing` | [![Barnegat lawn mowing page screenshot](docs/page-flow-screenshots/thumbs/barnegat-lawn-mowing.png)](docs/page-flow-screenshots/barnegat-lawn-mowing.png) |
| `/barnegat-nj/yard-cleanup` | [![Barnegat yard cleanup page screenshot](docs/page-flow-screenshots/thumbs/barnegat-yard-cleanup.png)](docs/page-flow-screenshots/barnegat-yard-cleanup.png) |
| `/services/lawn-mowing` | [![Lawn mowing service page screenshot](docs/page-flow-screenshots/thumbs/service-lawn-mowing.png)](docs/page-flow-screenshots/service-lawn-mowing.png) |
| `/services/yard-cleanup` | [![Yard cleanup service page screenshot](docs/page-flow-screenshots/thumbs/service-yard-cleanup.png)](docs/page-flow-screenshots/service-yard-cleanup.png) |

### Help And Policy Pages

| Page | Screenshot |
| --- | --- |
| `/help` | [![Help page screenshot](docs/page-flow-screenshots/thumbs/help.png)](docs/page-flow-screenshots/help.png) |
| `/support` | [![Support page screenshot](docs/page-flow-screenshots/thumbs/support.png)](docs/page-flow-screenshots/support.png) |
| `/cancellation-policy` | [![Cancellation policy screenshot](docs/page-flow-screenshots/thumbs/cancellation-policy.png)](docs/page-flow-screenshots/cancellation-policy.png) |
| `/refund-policy` | [![Refund policy screenshot](docs/page-flow-screenshots/thumbs/refund-policy.png)](docs/page-flow-screenshots/refund-policy.png) |
| `/booking-expectations` | [![Booking expectations screenshot](docs/page-flow-screenshots/thumbs/booking-expectations.png)](docs/page-flow-screenshots/booking-expectations.png) |
| `/provider-verification` | [![Provider verification screenshot](docs/page-flow-screenshots/thumbs/provider-verification.png)](docs/page-flow-screenshots/provider-verification.png) |
| `/provider-standards` | [![Provider standards screenshot](docs/page-flow-screenshots/thumbs/provider-standards.png)](docs/page-flow-screenshots/provider-standards.png) |
| `/privacy-policy` | [![Privacy policy screenshot](docs/page-flow-screenshots/thumbs/privacy-policy.png)](docs/page-flow-screenshots/privacy-policy.png) |
| `/terms-of-service` | [![Terms of service screenshot](docs/page-flow-screenshots/thumbs/terms-of-service.png)](docs/page-flow-screenshots/terms-of-service.png) |

## Static Visual Flow Diagrams

These PNG diagrams are generated from the route screenshots, so they render in ordinary Markdown viewers without Mermaid image-node support. Each diagram can be opened directly for a full-size view.

### Main Web Flow

[![Main web flow diagram](docs/page-flow-diagrams/main-web-flow.png)](docs/page-flow-diagrams/main-web-flow.png)

### Signup And Login Flow

[![Signup and login flow diagram](docs/page-flow-diagrams/signup-login-flow.png)](docs/page-flow-diagrams/signup-login-flow.png)

### Workspace Flow

[![Workspace flow diagram](docs/page-flow-diagrams/workspace-flow.png)](docs/page-flow-diagrams/workspace-flow.png)

### Customer Workspace Flow

[![Customer workspace flow diagram](docs/page-flow-diagrams/customer-workspace-flow.png)](docs/page-flow-diagrams/customer-workspace-flow.png)

### Provider Workspace Flow

[![Provider workspace flow diagram](docs/page-flow-diagrams/provider-workspace-flow.png)](docs/page-flow-diagrams/provider-workspace-flow.png)

### Crew Workspace Flow

[![Crew workspace flow diagram](docs/page-flow-diagrams/crew-workspace-flow.png)](docs/page-flow-diagrams/crew-workspace-flow.png)

### Content, Local, And Policy Flow

[![Content local and policy flow diagram](docs/page-flow-diagrams/content-local-policy-flow.png)](docs/page-flow-diagrams/content-local-policy-flow.png)

## Main Web Flow

```mermaid
flowchart TD
  home["/ <br/>Home / public marketplace search"]
  customer["/customer <br/>Book a service / public search"]
  listings["/customer/listings?... <br/>Recommended provider results"]
  auth["/auth <br/>Choose signup role"]
  login["/login <br/>Choose login role"]
  help["/help <br/>Help center + contact + support tickets"]

  home -->|primary nav: Book a service| customer
  home -->|search, service tiles, provider rails| listings
  customer -->|search by service, area, timing| listings
  listings -->|create account to book| auth
  listings -->|customer login| loginCustomer["/login/customer"]
  listings -->|request service / no coverage| help

  home -->|business CTA| provider["/provider"]
  home -->|crew CTA| authCrew["/auth/crew"]
  home -->|trust links| contentHub["Public content + policy pages"]
  customer -->|same public search experience| listings
```

## Signup And Login

```mermaid
flowchart TD
  auth["/auth <br/>Signup role picker"]
  authCustomer["/auth/customer <br/>Customer signup"]
  authProvider["/auth/provider <br/>Legacy redirect to /provider"]
  authProviderCreate["/auth/provider/create <br/>Create provider account"]
  authCrew["/auth/crew <br/>Crew signup"]
  authComplete["/auth/complete <br/>Social auth callback / finish profile"]

  login["/login <br/>Login role picker"]
  loginCustomer["/login/customer <br/>Customer login"]
  loginProvider["/login/provider <br/>Provider login"]
  loginCrew["/login/crew <br/>Crew login"]
  loginOps["/login/ops <br/>Ops login"]

  customerDashboard["/customer/dashboard <br/>Customer workspace"]
  providerManagement["/provider/management <br/>Provider management portal"]
  crewHome["/crew <br/>Crew work dashboard"]
  ops["/ops <br/>Operations dashboard"]

  auth --> authCustomer
  auth --> authProviderCreate
  auth --> authCrew
  authProvider -->|redirect| providerPublic["/provider <br/>Provider overview"]
  authCustomer -->|create account| customerDashboard
  authCustomer -->|Google / Apple callback| authComplete
  providerPublic -->|Get started| authProviderCreate
  authProviderCreate -->|create account| providerManagement
  authProviderCreate -->|Google / Apple callback| authComplete
  authCrew -->|submit crew profile| crewHome
  authCrew -->|Google / Apple callback| authComplete

  authComplete -->|customer role| customerDashboard
  authComplete -->|provider role| providerManagement
  authComplete -->|crew-member role| crewHome
  authComplete -->|ops role| ops

  login --> loginCustomer
  login --> loginProvider
  login --> loginCrew
  loginCustomer -->|login success| customerDashboard
  loginProvider -->|login success| providerManagement
  loginCrew -->|login success| crewHome
  loginOps -->|login success| ops
```

## Customer Workspace

```mermaid
flowchart TD
  customer["/customer <br/>Search services"]
  listings["/customer/listings?... <br/>Provider recommendations"]
  dashboard["/customer/dashboard <br/>Customer account / live bookings"]
  requestFlow["/customer/dashboard?flow=request <br/>Request service flow"]
  historyView["/customer/dashboard?view=history <br/>Past visits tab"]
  historyRedirect["/customer/history <br/>Redirect page"]
  help["/help <br/>Support"]
  loginCustomer["/login/customer <br/>Customer login"]

  customer -->|search| listings
  listings -->|create account to book| auth["/auth"]
  listings -->|log in| loginCustomer
  loginCustomer -->|login success| dashboard
  customer -->|signed-in profile menu: Account| dashboard
  dashboard -->|new service request| requestFlow
  dashboard -->|past visits link / tab| historyView
  historyRedirect -->|server redirect| historyView
  dashboard -->|booking issue / support links| help
  dashboard -->|no session fallback| loginCustomer
```

## Provider Workspace

```mermaid
flowchart TD
  provider["/provider <br/>Provider overview"]
  authProvider["/auth/provider <br/>Legacy redirect to /provider"]
  createProvider["/auth/provider/create <br/>Create provider account"]
  loginProvider["/login/provider <br/>Provider login"]
  management["/provider/management <br/>Management portal"]
  payments["/provider/payments <br/>Payments"]
  partnerships["/provider/partnerships <br/>Concept partnership page"]
  crew["/crew <br/>Crew hiring / open work"]
  customer["/customer <br/>For property owners"]
  listings["/customer/listings <br/>Sponsored placement / marketplace results"]
  help["/help <br/>Help center"]
  apiDocs["API docs <br/>Configured API server /api/docs"]
  policies["Provider trust pages <br/>/provider-verification, /provider-standards"]

  provider -->|Get started| createProvider
  provider -->|Business owner login| loginProvider
  provider -->|standards / verification links| policies
  authProvider -->|redirect| provider
  createProvider -->|create account| management
  loginProvider -->|login success| management

  management -->|Find crew members| crew
  management -->|Back to overview| provider
  management -->|support links from jobs| help
  payments --> management
  payments --> provider
  payments --> help
  partnerships --> createProvider
  partnerships --> provider

  providerHeader["Provider header menus"] --> createProvider
  providerHeader --> management
  providerHeader --> payments
  providerHeader --> crew
  providerHeader --> customer
  providerHeader --> listings
  providerHeader --> help
  providerHeader --> apiDocs
```

## Crew Workspace

```mermaid
flowchart TD
  crew["/crew <br/>Open crew work / crew dashboard"]
  authCrew["/auth/crew?... <br/>Crew signup, optionally prefilled from an opening"]
  loginCrew["/login/crew <br/>Crew login"]
  schedule["/crew/schedule <br/>Upcoming schedule"]
  history["/crew/schedule/history <br/>Past job history"]
  help["/help?... <br/>Crew assignment support"]

  crew -->|Crew login| loginCrew
  crew -->|Crew sign up / selected opening| authCrew
  authCrew -->|submit profile| crew
  loginCrew -->|login success| crew
  crew -->|signed-in profile menu| schedule
  schedule -->|schedule menu| history
  history -->|schedule menu| schedule
  crew -->|assignment support| help
  schedule -->|no session fallback| loginCrew
  history -->|no session fallback| loginCrew
```

## Content, Local, And Policy Pages

```mermaid
flowchart TD
  footer["Global footer / content links"]
  help["/help <br/>Help center"]
  about["/about <br/>About"]
  launch["/barnegat-nj <br/>Launch area overview"]
  localMowing["/barnegat-nj/lawn-mowing <br/>Local lawn mowing"]
  localCleanup["/barnegat-nj/yard-cleanup <br/>Local yard cleanup"]
  serviceMowing["/services/lawn-mowing <br/>Service landing"]
  serviceCleanup["/services/yard-cleanup <br/>Service landing"]
  customer["/customer <br/>Find provider"]
  provider["/provider <br/>Provider overview"]
  crew["/crew <br/>Crew hiring"]
  policyHub["Trust policy pages"]

  footer --> about
  footer --> help
  footer --> launch
  footer --> serviceMowing
  footer --> serviceCleanup
  footer --> provider
  footer --> crew
  footer --> policyHub

  launch -->|Find my provider| customer
  launch -->|Why GreenRain works this way| about
  launch --> localMowing
  launch --> localCleanup
  launch --> providerVerification["/provider-verification"]
  launch --> help

  serviceMowing --> customer
  serviceMowing --> serviceCleanup
  serviceCleanup --> customer
  serviceCleanup --> serviceMowing
  localMowing --> customer
  localMowing --> localCleanup
  localCleanup --> customer
  localCleanup --> localMowing

  help --> policyHub
  policyHub --> help
  policyHub --> launch
```

Trust policy pages:

- `/support`
- `/cancellation-policy`
- `/refund-policy`
- `/booking-expectations`
- `/provider-verification`
- `/provider-standards`
- `/privacy-policy`
- `/terms-of-service`

## Complete Web Route Inventory

Public and discovery:

- `/`
- `/about`
- `/barnegat-nj`
- `/barnegat-nj/lawn-mowing`
- `/barnegat-nj/yard-cleanup`
- `/services/lawn-mowing`
- `/services/yard-cleanup`
- `/customer`
- `/customer/listings`
- `/help`
- `/support`
- `/booking-expectations`
- `/cancellation-policy`
- `/refund-policy`
- `/provider-verification`
- `/provider-standards`
- `/privacy-policy`
- `/terms-of-service`

Authentication:

- `/auth`
- `/auth/customer`
- `/auth/provider` redirects to `/provider`
- `/auth/provider/create`
- `/auth/crew`
- `/auth/complete`
- `/login`
- `/login/customer`
- `/login/provider`
- `/login/crew`
- `/login/ops`

Role workspaces:

- `/customer/dashboard`
- `/customer/history` redirects to `/customer/dashboard?view=history`
- `/provider`
- `/provider/management`
- `/provider/payments`
- `/provider/partnerships` internal/concept page
- `/crew`
- `/crew/schedule`
- `/crew/schedule/history`
- `/ops`
