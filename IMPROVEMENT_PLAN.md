# Focused improvement plan

## October 16, 2026 — bounded recurring payments

User request: model contract work, seasonal jobs, and other income/expenses with definite payment start and end dates, including gaps between gigs. Preserve a reviewable implementation and change history.

Scope:

1. Add an optional start date to weekly, monthly, and every-two-week income/expense rules. Retain the existing inclusive final-payment date and occurrence-count controls.
2. Explain that dates describe cash arriving/leaving an account. A contract ending December 18 can have its final payment on December 25; a separate rule can resume January 15.
3. Preserve existing saved plans and JSON/Drive payload compatibility. Anchor count-limited schedules so refreshing the forecast does not restart the payment count.
4. Fix related audit findings: daylight-saving/calendar-day arithmetic, adding while collapsed, invalid amounts/monthly days/date ranges, and mobile cushion-help clipping.
5. Verify scheduling logic across time zones, desktop/mobile editing, reload persistence, and the contract-gap example. Record results in CHANGELOG.md.

Deferred: dashboard summary redesign, compact mobile ledger/editors, undo and scenario redesign, broader backup changes, and privacy/terms navigation. These remain opportunities from the audit, outside this focused feature pass.

No bank integrations, payroll calculations, automatic work-date-to-payment-date conversion, or new cloud storage are introduced.

Status: implemented and verified locally. Ready for user review; not deployed. See CHANGELOG.md for completed checks and remaining audit work.
