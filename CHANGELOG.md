# Changelog

## 2026-10-16 — Payment start dates and scheduling reliability

### Added

- Optional payment start dates for recurring income and expenses, alongside existing end dates and occurrence limits.
- Plain-language payment-date guidance for contract/seasonal work. Date boundaries are inclusive; the selected weekday/monthly day/biweekly cadence still determines the actual payment dates.
- Inline validation for start/end ordering, invalid dates, negative or malformed amounts, monthly days, and occurrence limits.
- Regression tests in tests/scheduling.test.cjs and a scoped IMPROVEMENT_PLAN.md.

### Fixed

- Daylight-saving transitions duplicating calendar days, double-charging monthly payments, shifting biweekly cadence, and potentially trapping occurrence counting in a loop.
- Date keys now use local calendar dates consistently for ledger entries, chart points, and individual exclusions.
- Count-limited rules retain their payment-count start when the forecast is refreshed. Legacy count-limited plans anchor to their saved forecast start date during normalization.
- Adding income/expenses reveals the collapsed editor; its Hide/Show button exposes its expanded state to assistive technology.
- Cushion help no longer extends off the left edge of a phone viewport.
- Cushion target inputs fit the 320px phone layout without clipping the green target.

### Compatibility and scope

- Existing recurring rules without a start date retain their original schedule. The existing version-3 JSON envelope is retained; the new per-rule field is additive and included in local and Drive backups.
- One-time items keep using their exact payment date. Their hidden recurring boundaries do not change one-time behavior.
- Existing user edits were preserved. No financial plan was reset, no external backup was overwritten, and no changes were deployed.
- Broader audit recommendations are tracked as deferred in IMPROVEMENT_PLAN.md.

### Validation

- 11 scheduling/validation regression tests pass under America/New_York and Pacific/Auckland (22 passing checks total).
- JavaScript syntax check passes.
- Browser checks pass for the December 25 → January 15 contract gap, adding while collapsed, rejecting/correcting an end date before the start, rejecting/correcting a negative amount, and retaining both contracts' dates after reload.
- Date editors inspected at 1280px, 768px, 390px, and 320px. No horizontal page overflow at the tested phone/tablet widths. Tooltip and all three cushion targets fit at 320px.
- Screenshots saved outside the app source in the chat's payment-dates visualization folder. The review preview uses isolated demo data on port 8767.
- Google authorization and actual Drive backup/restore were not exercised; backup field preservation is covered by JSON normalization/round-trip regression tests.
- JavaScript syntax and git diff whitespace checks pass.
