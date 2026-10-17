# Focused improvement plan

## October 16, 2026 — bounded recurring payments

User request: model contract work, seasonal jobs, and other income/expenses with definite payment start and end dates, including gaps between gigs. Preserve a reviewable implementation and change history.

Scope:

1. Add an optional start date to weekly, monthly, and every-two-week income/expense rules. Retain the existing inclusive final-payment date and occurrence-count controls.
2. Explain that dates describe cash arriving/leaving an account. A contract ending December 18 can have its final payment on December 25; a separate rule can resume January 15.
3. Preserve existing saved plans and JSON/Drive payload compatibility. Anchor count-limited schedules so refreshing the forecast does not restart the payment count.
4. Fix related audit findings: daylight-saving/calendar-day arithmetic, adding while collapsed, invalid amounts/monthly days/date ranges, and mobile cushion-help clipping.
5. Verify scheduling logic across time zones, desktop/mobile editing, reload persistence, and the contract-gap example. Record results in CHANGELOG.md.

Deferred product ideas: dashboard summary redesign, compact mobile ledger/editors, undo and scenario redesign, and broader backup changes. Privacy and terms navigation are now present. These remaining ideas are outside the focused payment-date feature and have no promised delivery date.

No bank integrations, payroll calculations, automatic work-date-to-payment-date conversion, or new cloud storage are introduced.

Status: implemented, verified, and deployed to https://amigoingbroke.me/ on October 16, 2026. Deployment run: https://github.com/vibe-coding-milan/am-i-going-broke/actions/runs/38992204659 (commit 4e7aaa2). The deployed commit includes the scheduling work and earlier GitHub/domain setup. See CHANGELOG.md for verification and later repository-only maintenance changes.
