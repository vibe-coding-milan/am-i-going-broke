# Mobile forecast refresh

> The subsequent [forecast refinement](REFINEMENT_REVIEW.md) supersedes the slider, balance-date selector, summary density, and header treatment described in this initial implementation record.

Historical status at the time of this review: implemented locally; deployment had not yet been recorded. Subsequent refinement and publication are recorded in the [changelog](../CHANGELOG.md). This document follows the [mobile audit](MOBILE_UX_AUDIT.md) and retains the initial implementation evidence; it is not the current UI specification or acceptance checklist. Current device follow-up is tracked in [issue #25](https://github.com/vibe-coding-milan/am-i-going-broke/issues/25).

## Scope and boundaries

The same saved plan and projection engine drive both layouts. The existing storage key, version-3 backup envelope, recurring payment bounds, and occurrence identifiers remain in use. No bank access, cloud migration, framework, or new runtime dependency was introduced.

On mobile, the interface now prioritizes the forecast and chart, offers quick section links, collapses secondary settings, and expands a single payment editor when needed. Transactions use compact rows and expose more rows on request. Desktop retains its wide chart, inline editors, layer controls, theme buttons, full table, and all transaction rows.

The full-period numerical overview remains authoritative. Chart tapping, the native date slider, and previous/next controls inspect the existing daily points; they never shorten the forecast or modify financial values. A static chart and HTML summaries remain available without using drag gestures.

Balance editing now includes an explicit as-of date. Users must enter the actual balance for that date; changing the balance no longer silently rolls the plan forward to today. Count-limited payments remain anchored to their start dates.

Valid payment edits save automatically. Invalid amount/date drafts remain visible with an error; Done will not close an invalid editor. Removal has an in-memory Undo action for the most recent removed rule, including its individual exclusions. Undo is not a durable history across reloads.

## Reliability and content

- Local storage write failures leave the in-memory plan usable and show a persistent download-backup warning.
- Unrelated/malformed-shape JSON and backups from newer versions are rejected before replacement.
- Restore confirmation shows the backup date, payment-rule count, balance and balance date. It includes an optional download of the current plan.
- Device theme follows the reported browser/OS preference, including a recheck on page resume. It is not a sunset schedule.
- Policy pages have contents navigation and return links. Privacy text describes Google Fonts and readable downloaded backups without introducing a new data destination.
- Red-threshold equality now produces the same risk classification as the chart/table coloring. This is a boundary-status correction; scheduled amounts and balances are unchanged.

## Verification recorded

- Project checks: source/shell syntax and local documentation/HTML links, plus 14 meaningful regressions under America/New_York and Pacific/Auckland.
- The October 16 four-rule sample retains a $3,865 minimum and $4,725 ending balance over 90 days. Chart inspection leaves those totals unchanged.
- Phone: compact summary/edit flow, invalid amount correction, one-click Done, removal/Undo, exclusion/restore-all, show-more, explicit balance date, 30/90-day periods, date-slider keyboard navigation, and reload persistence.
- Contract editing: a Friday payment rule from December 4 through December 25 retains both bounds after Done and reload. Existing regression tests cover the unpaid gap before January 15.
- Desktop: wide chart, inline editors, and table inspected at 1280px; inline date controls and overflow checked at 1024px.
- Phone/landscape: 393px and 320px reflow; 760 × 393 menu containment with internal scrolling.
- In the sample, permanently expanded payment content decreased from about 2,530px to about 490px; the initial page decreased from about 10,800px to about 4,500px. These measurements depend on data and viewport.
- Screenshots are stored with the chat's mobile-refresh review artifacts, outside the public app upload set.

Actual Pixel Firefox, Chrome Android, Safari iOS, mobile virtual keyboards/native pickers, enlarged system text, assistive technology, real Google authorization, and Drive upload/restore have not been certified by these in-app-browser checks. These remain acceptance checks for real-device review, not reasons to infer a confirmed browser defect.

## Repository and release handling

The mobile application files, policy copy, tests, audit record, and changelog form the review scope. Concurrent deployment/operations edits from the other chat are outside this scope and must not be overwritten or silently included in the mobile change. Use the repository's project checks and configured deployment process when publishing. Record a production commit/run separately only after a successful deployment.

Financial data stays in the user's browser or explicitly chosen backups. Source publication does not copy the developer's local sample data, and a local preview uses a separate origin from the live site.
