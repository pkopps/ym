// Connections are user actions, not organizational relationships. Keep this list tied to UI code or tests.
export const states = [
  ["customer:cancelled", "Cancelled recovery visit", "customer", "/customer/dashboard"],
  ["provider:credentials", "Credentials pending or rejected", "provider", "/provider/management"],
  ["provider:approved", "Approved marketplace profile", "provider", "/provider/management"],
  ["provider:payout-ready", "Connect readiness review", "provider", "/provider/payments"],
  ["crew:interest", "Opening selected before signup", "crew", "/crew"],
  ["crew:claim-recovery", "Account created, opening unavailable", "crew", "/crew?openingClaim=unavailable"],
  ["customer:recovery", "Customer recovery consent required", "customer", "/customer/dashboard"],
  ["customer:property-review", "Property correction awaiting review", "customer", "/customer/dashboard"],
  ["customer:top-matches", "Top local matches", "customer", "/customer/listings"],
  ["customer:directory", "Full local directory", "customer", "/customer/listings?view=directory"],
  ["customer:quote", "Quote and recommendation", "customer", "/customer/dashboard?flow=request"],
  ["customer:request-pending", "Request pending", "customer", "/customer/dashboard"],
  ["customer:confirmed", "Confirmed booking", "customer", "/customer/dashboard"],
  ["customer:history", "Completed visit", "customer", "/customer/history"],
  ["customer:dispute", "Service issue", "customer", "/help?issueType=service-quality"],
  ["provider:review", "New request to review", "provider", "/provider/management"],
  ["provider:confirmed", "Confirmed job", "provider", "/provider/management"],
  ["provider:on-route", "Crew on route", "provider", "/provider/management"],
  ["provider:complete", "Job completed", "provider", "/provider/management"],
  ["crew:assignment", "Accepted assignment", "crew", "/crew/schedule"],
  ["ops:case", "Complaint review", "ops", "/ops?view=support#ops-support"]
].map(([id, label, role, url]) => ({ id, label, role, url, kind: "state" }));

const web = (path) => `web:${path}`;
const mobile = (app, tab) => `mobile:${app}:${tab}`;
const edge = (from, to, action, role = "public", state = "", evidence = "code-inferred", source = "") => ({
  from, to, action, role, state, evidence, source
});

export const curatedEdges = [
  edge(web("/provider/management"), "provider:credentials", "Submit or resubmit credentials", "provider", "account created", "test-verified", "tests/web/provider-onboarding-flow.spec.ts"),
  edge("provider:credentials", "provider:approved", "Ops verifies credentials and approves", "ops", "all requirements verified", "test-verified", "tests/web/provider-onboarding-flow.spec.ts"),
  edge("provider:approved", "provider:payout-ready", "Start or resume Connect", "provider", "external onboarding", "code-inferred", "apps/provider-mobile/src/components/ProviderActivationCard.tsx"),
  edge(web("/crew"), "crew:interest", "Select opening", "public", "no assignment yet", "test-verified", "tests/web/critical-path-recovery.spec.ts"),
  edge("crew:interest", "crew:claim-recovery", "Create account after opening disappears", "crew", "session retained", "test-verified", "tests/web/critical-path-recovery.spec.ts"),
  edge("crew:claim-recovery", web("/crew"), "Find another opening", "crew", "authenticated account", "code-inferred", "apps/web/src/components/CrewLiveDashboard.tsx"),
  edge("provider:review", "customer:recovery", "Decline or withdraw visit", "provider", "not traveling or working", "test-verified", "apps/api/test/critical-path.test.ts"),
  edge("customer:recovery", "customer:request-pending", "Consent to equivalent replacement", "customer", "fresh availability and unchanged price", "test-verified", "tests/web/critical-path-recovery.spec.ts"),
  edge("customer:recovery", "customer:cancelled", "Cancel without recovery fee", "customer", "refund reviewed if captured", "test-verified", "apps/api/test/critical-path.test.ts"),
  edge("customer:confirmed", "customer:property-review", "Request property correction", "customer", "before travel", "test-verified", "apps/api/test/critical-path.test.ts"),
  edge("customer:property-review", "customer:confirmed", "Approve equivalent property", "provider", "owned visit and price preserved", "test-verified", "apps/api/test/critical-path.test.ts"),
  edge(web("/"), web("/customer/listings"), "Find my match", "public", "service and area selected", "test-verified", "tests/web/customer-booking-golden-path.spec.ts"),
  edge(web("/"), web("/customer"), "Book service", "public", "", "test-verified", "tests/web/customer-booking-golden-path.spec.ts"),
  edge(web("/"), web("/provider"), "For providers", "public", "", "code-inferred", "apps/web/src/components/NavBar.tsx"),
  edge(web("/"), web("/crew"), "For crews", "public", "", "code-inferred", "apps/web/src/components/NavBar.tsx"),
  edge(web("/"), web("/auth"), "Sign up", "public", "", "code-inferred", "apps/web/src/components/NavBar.tsx"),
  edge(web("/"), web("/help"), "Help center", "public", "", "code-inferred", "apps/web/src/components/NavBar.tsx"),
  edge(web("/customer"), web("/customer/listings"), "Search service and area", "public", "", "test-verified", "tests/web/smoke.spec.ts"),
  edge(web("/customer/listings"), "customer:top-matches", "Review top matches", "public", "search returned providers", "test-verified", "tests/web/customer-booking-golden-path.spec.ts"),
  edge("customer:top-matches", "customer:directory", "Browse all matching businesses", "public", "directory requested", "test-verified", "tests/web/customer-booking-golden-path.spec.ts"),
  edge("customer:directory", "customer:top-matches", "Back to top matches", "public", "directory open", "test-verified", "tests/web/customer-booking-golden-path.spec.ts"),
  edge("customer:top-matches", web("/auth/customer"), "See price and request", "public", "selected provider", "test-verified", "tests/web/customer-booking-golden-path.spec.ts"),
  edge("customer:directory", web("/auth/customer"), "Request directory business", "public", "selected provider", "code-inferred", "apps/web/src/components/PublicCustomerListingsExperience.tsx"),
  edge(web("/customer/listings"), web("/auth/customer"), "See price and request", "public", "selected provider", "test-verified", "tests/web/customer-booking-golden-path.spec.ts"),
  edge(web("/auth/customer"), web("/customer/dashboard"), "Create customer account", "customer", "signup complete", "test-verified", "tests/web/customer-booking-golden-path.spec.ts"),
  edge(web("/login/customer"), web("/customer/dashboard"), "Log in", "customer", "existing account", "test-verified", "tests/web/customer-booking-golden-path.spec.ts"),
  edge(web("/customer/dashboard"), "customer:quote", "See quote and recommendation", "customer", "request flow", "test-verified", "tests/web/customer-booking-golden-path.spec.ts"),
  edge("customer:quote", "customer:request-pending", "Request recommended provider", "customer", "quote accepted", "test-verified", "tests/web/customer-booking-golden-path.spec.ts"),
  edge("customer:request-pending", "provider:review", "Provider receives request", "provider", "requested", "test-verified", "tests/web/provider-job-lifecycle.spec.ts"),
  edge("provider:review", "provider:confirmed", "Confirm booking", "provider", "requested", "test-verified", "tests/web/provider-job-lifecycle.spec.ts"),
  edge("provider:confirmed", "customer:confirmed", "Customer sees confirmation", "customer", "confirmed", "test-verified", "tests/web/booking-schedule.spec.ts"),
  edge("provider:confirmed", "provider:on-route", "Mark on route", "provider", "confirmed", "test-verified", "tests/web/provider-job-lifecycle.spec.ts"),
  edge("provider:on-route", "provider:complete", "Complete job", "provider", "on route", "test-verified", "tests/web/provider-job-lifecycle.spec.ts"),
  edge("provider:complete", "customer:history", "View completed visit", "customer", "completed", "test-verified", "tests/web/crew-assignment-flow.spec.ts"),
  edge(web("/customer/dashboard"), web("/customer/history"), "Past visits", "customer", "signed in", "code-inferred", "apps/web/src/components/NavBar.tsx"),
  edge(web("/customer/dashboard"), web("/customer/referrals"), "Referrals", "customer", "signed in", "test-verified", "tests/web/customer-referrals.spec.ts"),
  edge(web("/customer/dashboard"), web("/account/security"), "Account security", "customer", "signed in", "code-inferred", "apps/web/src/components/CustomerAppHeader.tsx"),
  edge(web("/customer/dashboard"), web("/help"), "Get booking help", "customer", "booking exists", "test-verified", "tests/web/service-complaints.spec.ts"),
  edge(web("/help"), "customer:dispute", "Report service issue", "customer", "booking exists", "test-verified", "tests/web/service-complaints.spec.ts"),
  edge("customer:dispute", "ops:case", "Request human review", "ops", "complaint submitted", "test-verified", "tests/web/service-complaints.spec.ts"),
  edge(web("/login/provider"), web("/provider/management"), "Log in", "provider", "approved account", "test-verified", "tests/web/provider-job-lifecycle.spec.ts"),
  edge(web("/auth/provider/create"), web("/provider/management"), "Create business account", "provider", "verification pending", "code-inferred", "apps/web/src/components/AccountSignupForm.tsx"),
  edge(web("/provider/management"), "provider:review", "Open new request", "provider", "requested", "test-verified", "tests/web/provider-job-lifecycle.spec.ts"),
  edge(web("/provider/management"), web("/provider/payments"), "Open payments", "provider", "signed in", "test-verified", "tests/web/provider-job-lifecycle.spec.ts"),
  edge(web("/provider/management"), web("/provider/clients"), "Open clients", "provider", "signed in", "test-verified", "tests/web/provider-clients.spec.ts"),
  edge(web("/provider/management"), web("/provider/partnerships"), "Business partnerships", "provider", "signed in", "code-inferred", "apps/web/src/components/ProviderManagementBoard.tsx"),
  edge(web("/login/crew"), web("/crew"), "Log in", "crew", "accepted crew", "test-verified", "tests/web/crew-assignment-flow.spec.ts"),
  edge(web("/crew"), web("/crew/schedule"), "Open schedule", "crew", "signed in", "test-verified", "tests/web/crew-assignment-flow.spec.ts"),
  edge(web("/crew/schedule"), "crew:assignment", "Open assigned job", "crew", "accepted", "test-verified", "tests/web/crew-assignment-flow.spec.ts"),
  edge(web("/crew/schedule"), web("/crew/schedule/history"), "View past assignments", "crew", "signed in", "test-verified", "tests/web/crew-assignment-flow.spec.ts"),
  edge(web("/login/ops"), web("/ops"), "Log in", "ops", "ops account", "test-verified", "tests/web/service-complaints.spec.ts"),
  edge(web("/ops"), web("/login/ops"), "Ops login required", "ops", "signed out", "code-inferred", "apps/web/src/components/OpsDashboardClient.tsx"),
  edge(web("/ops"), "ops:case", "Open support case", "ops", "complaint submitted", "test-verified", "tests/web/service-complaints.spec.ts"),
  edge(web("/auth"), web("/auth/customer"), "Customer sign up", "public", "", "code-inferred", "apps/web/src/app/auth/page.tsx"),
  edge(web("/auth"), web("/auth/provider/create"), "Provider sign up", "public", "", "code-inferred", "apps/web/src/app/auth/page.tsx"),
  edge(web("/auth/provider"), web("/provider"), "Legacy provider URL redirects", "public", "", "code-inferred", "apps/web/src/app/auth/provider/page.tsx"),
  edge(web("/auth"), web("/auth/crew"), "Crew sign up", "public", "", "code-inferred", "apps/web/src/app/auth/page.tsx"),
  edge(web("/login"), web("/login/customer"), "Customer login", "public", "", "code-inferred", "apps/web/src/app/login/page.tsx"),
  edge(web("/login"), web("/login/provider"), "Provider login", "public", "", "code-inferred", "apps/web/src/app/login/page.tsx"),
  edge(web("/login"), web("/login/crew"), "Crew login", "public", "", "code-inferred", "apps/web/src/app/login/page.tsx"),
  edge(web("/auth/customer"), web("/auth/complete"), "Continue with social sign up", "customer", "social authorization returns", "code-inferred", "apps/web/src/components/AccountSignupForm.tsx"),
  edge(web("/auth/provider/create"), web("/auth/complete"), "Continue with social sign up", "provider", "social authorization returns", "code-inferred", "apps/web/src/components/AccountSignupForm.tsx"),
  edge(web("/auth/crew"), web("/auth/complete"), "Continue with social sign up", "crew", "social authorization returns", "code-inferred", "apps/web/src/components/AccountSignupForm.tsx"),
  edge(web("/login/customer"), web("/auth/complete"), "Continue with social login", "customer", "social authorization returns", "code-inferred", "apps/web/src/components/RoleLoginCard.tsx"),
  edge(web("/login/provider"), web("/auth/complete"), "Continue with social login", "provider", "social authorization returns", "code-inferred", "apps/web/src/components/RoleLoginCard.tsx"),
  edge(web("/login/crew"), web("/auth/complete"), "Continue with social login", "crew", "social authorization returns", "code-inferred", "apps/web/src/components/RoleLoginCard.tsx"),
  edge(web("/login/ops"), web("/auth/complete"), "Continue with social login", "ops", "social authorization returns", "code-inferred", "apps/web/src/components/RoleLoginCard.tsx"),
  edge(web("/auth/complete"), web("/customer/dashboard"), "Finish customer sign in", "customer", "social authorization complete", "code-inferred", "apps/web/src/app/auth/complete/page.tsx"),
  edge(web("/auth/complete"), web("/provider/management"), "Finish provider sign in", "provider", "social authorization complete", "code-inferred", "apps/web/src/app/auth/complete/page.tsx"),
  edge(web("/auth/complete"), web("/crew"), "Finish crew sign in", "crew", "social authorization complete", "code-inferred", "apps/web/src/app/auth/complete/page.tsx"),
  edge(web("/auth/complete"), web("/ops"), "Finish ops sign in", "ops", "social authorization complete", "code-inferred", "apps/web/src/app/auth/complete/page.tsx")
];

for (const [app, tabs, first] of [
  ["customer", ["dashboard", "book", "bookings", "account"], "dashboard"],
  ["provider", ["dashboard", "schedule", "crew", "account"], "dashboard"],
  ["crew", ["today", "schedule", "availability", "account"], "today"]
]) {
  curatedEdges.push(edge(mobile(app, "auth"), mobile(app, first), "Sign in", app, "authenticated", "code-inferred", `apps/${app}-mobile/src/App.tsx`));
  for (const tab of tabs) {
    if (tab !== first) curatedEdges.push(edge(mobile(app, first), mobile(app, tab), `Tap ${tab} tab`, app, "authenticated", "code-inferred", `apps/${app}-mobile/src/navigation/${app[0].toUpperCase()}${app.slice(1)}AppNavigator.tsx`));
  }
}
curatedEdges.push(
  edge(mobile("customer", "dashboard"), mobile("customer", "bookings"), "Open visits", "customer", "authenticated", "code-inferred", "apps/customer-mobile/src/navigation/CustomerAppNavigator.tsx"),
  edge(mobile("customer", "book"), mobile("customer", "bookings"), "Open bookings", "customer", "request made", "code-inferred", "apps/customer-mobile/src/navigation/CustomerAppNavigator.tsx"),
  edge(mobile("crew", "today"), mobile("crew", "schedule"), "Open assignments", "crew", "authenticated", "code-inferred", "apps/crew-mobile/src/navigation/CrewAppNavigator.tsx")
);
